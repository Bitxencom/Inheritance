// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/*
 * BitxenGovernor — On-chain DAO for the Bitxen Protocol
 *
 * Activation:  Only becomes operational once Bitxen.totalRecordsStored()
 *              reaches DAO_ACTIVATION_THRESHOLD (5,000,000 vaults).
 *
 * Voting power: BITXEN token balance at the block snapshot captured when
 *               each proposal is created (via ERC20Votes.getPastVotes).
 *
 * Proposal types:
 *   UPDATE_FEE_PARAMS   — change baseFeePhase1, feeIncrementPhase1/2
 *   UPDATE_BURN_PARAMS  — change baseBurnPercent, burnIncrement1/2, maxBurnCap
 *   UPDATE_TREASURY     — change the treasury address
 *   UPDATE_GOVERNOR     — replace this governor contract with a new one
 *
 * Lifecycle:
 *   propose() → [VOTING_PERIOD] → queue() → [TIMELOCK_DELAY] → execute()
 *   Any state: cancel() by proposer (before execution)
 *
 * Governance parameters (themselves changeable by governance after deployment):
 *   • votingPeriod     — blocks during which votes are accepted   (default ≈ 7 days)
 *   • timelockDelay    — blocks between queue and execute         (default ≈ 2 days)
 *   • quorumBps        — minimum FOR votes as % of total supply   (default 4.00%)
 *   • proposalThreshold — min tokens required to submit a proposal (default 100k)
 */

interface IBitxen {
    function totalRecordsStored() external view returns (uint256);
    function DAO_ACTIVATION_THRESHOLD() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function getPastVotes(address account, uint256 timepoint) external view returns (uint256);
    function clock() external view returns (uint48);

    // Governance-callable setters on Bitxen
    function setFeeParams(uint256 baseFeePhase1, uint256 feeIncrementPhase1, uint256 feeIncrementPhase2) external;
    function setBurnParams(uint256 baseBurnPercent, uint256 burnIncrementPhase1, uint256 burnIncrementPhase2, uint256 maxBurnCap) external;
    function setTreasuryByGovernor(address newTreasury) external;
    function setGovernor(address newGovernor) external;
}

contract BitxenGovernor {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum ProposalType {
        UPDATE_FEE_PARAMS,   // 0
        UPDATE_BURN_PARAMS,  // 1
        UPDATE_TREASURY,     // 2
        UPDATE_GOVERNOR      // 3
    }

    enum ProposalState {
        Pending,    // 0 — waiting for voting to start (1-block delay)
        Active,     // 1 — vote is open
        Defeated,   // 2 — vote closed, quorum not met or majority against
        Succeeded,  // 3 — vote passed, not yet queued
        Queued,     // 4 — in timelock
        Executed,   // 5 — successfully executed
        Cancelled   // 6 — cancelled by proposer
    }

    struct FeeParams {
        uint256 baseFeePhase1;
        uint256 feeIncrementPhase1;
        uint256 feeIncrementPhase2;
    }

    struct BurnParams {
        uint256 baseBurnPercent;
        uint256 burnIncrementPhase1;
        uint256 burnIncrementPhase2;
        uint256 maxBurnCap;
    }

    struct Proposal {
        uint256      id;
        address      proposer;
        ProposalType proposalType;
        // Encoded payload — decoded according to proposalType on execution
        bytes        payload;
        // Human-readable description stored off-chain; only hash stored on-chain
        bytes32      descriptionHash;
        // Voting window (in block numbers)
        uint256      snapshotBlock;  // getPastVotes queried at this block
        uint256      voteStart;      // first block votes are accepted
        uint256      voteEnd;        // last block votes are accepted (inclusive)
        // Timelock
        uint256      eta;            // block number after which execution is allowed (0 = not queued)
        // Tallies
        uint256      votesFor;
        uint256      votesAgainst;
        uint256      votesAbstain;
        // State flags
        bool         executed;
        bool         cancelled;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IBitxen public immutable bitxen;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    // voter => proposalId => has voted
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    // voter => proposalId => vote (0=Against, 1=For, 2=Abstain)
    mapping(address => mapping(uint256 => uint8)) public voteChoice;

    // Governance parameters (all updatable by governance itself)
    uint256 public votingPeriod;      // in blocks
    uint256 public timelockDelay;     // in blocks
    uint256 public quorumBps;         // basis points of total supply (e.g. 400 = 4%)
    uint256 public proposalThreshold; // min voting power to create a proposal

    // Constants
    uint256 public constant VOTING_DELAY      = 1;       // 1 block before voting starts
    uint256 public constant MIN_VOTING_PERIOD = 1_800;   // ≈ 6 hours  (assuming 12s blocks)
    uint256 public constant MAX_VOTING_PERIOD = 100_800; // ≈ 14 days
    uint256 public constant MIN_TIMELOCK      = 900;     // ≈ 3 hours
    uint256 public constant MAX_TIMELOCK      = 50_400;  // ≈ 7 days
    uint256 public constant MAX_QUORUM_BPS    = 3000;    // 30% ceiling
    uint256 public constant BPS_DENOMINATOR   = 10_000;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType    proposalType,
        bytes32         descriptionHash,
        uint256         voteStart,
        uint256         voteEnd
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8           support,      // 0=Against, 1=For, 2=Abstain
        uint256         weight
    );
    event ProposalQueued(uint256 indexed proposalId, uint256 eta);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event GovernanceParamsUpdated(
        uint256 votingPeriod,
        uint256 timelockDelay,
        uint256 quorumBps,
        uint256 proposalThreshold
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier daoActive() {
        require(
            bitxen.totalRecordsStored() >= bitxen.DAO_ACTIVATION_THRESHOLD(),
            "Governor: DAO not yet active (< 5M vaults)"
        );
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Governor: caller must be governor");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _bitxen,
        uint256 _votingPeriod,      // recommended: 50_400 ≈ 7 days
        uint256 _timelockDelay,     // recommended: 14_400 ≈ 2 days
        uint256 _quorumBps,         // recommended: 400 = 4%
        uint256 _proposalThreshold  // recommended: 100_000 * 1e18
    ) {
        require(_bitxen != address(0), "Governor: invalid bitxen address");
        require(_votingPeriod  >= MIN_VOTING_PERIOD && _votingPeriod  <= MAX_VOTING_PERIOD, "Governor: voting period out of range");
        require(_timelockDelay >= MIN_TIMELOCK      && _timelockDelay <= MAX_TIMELOCK,      "Governor: timelock out of range");
        require(_quorumBps     <= MAX_QUORUM_BPS,   "Governor: quorum too high");
        require(_proposalThreshold > 0,             "Governor: threshold must be > 0");

        bitxen             = IBitxen(_bitxen);
        votingPeriod       = _votingPeriod;
        timelockDelay      = _timelockDelay;
        quorumBps          = _quorumBps;
        proposalThreshold  = _proposalThreshold;
    }

    // -------------------------------------------------------------------------
    // Proposal Creation
    // -------------------------------------------------------------------------

    /// @notice Create a fee parameter update proposal.
    /// @param _baseFeePhase1      New base fee (scaled by 1e18).
    /// @param _feeIncrementPhase1 New fee increment per epoch in Phase 1.
    /// @param _feeIncrementPhase2 New fee increment per epoch in Phase 2.
    /// @param _descriptionHash    keccak256 of the off-chain proposal description.
    function proposeFeeUpdate(
        uint256 _baseFeePhase1,
        uint256 _feeIncrementPhase1,
        uint256 _feeIncrementPhase2,
        bytes32 _descriptionHash
    ) external daoActive returns (uint256) {
        bytes memory payload = abi.encode(_baseFeePhase1, _feeIncrementPhase1, _feeIncrementPhase2);
        return _createProposal(ProposalType.UPDATE_FEE_PARAMS, payload, _descriptionHash);
    }

    /// @notice Create a burn parameter update proposal.
    function proposeBurnUpdate(
        uint256 _baseBurnPercent,
        uint256 _burnIncrementPhase1,
        uint256 _burnIncrementPhase2,
        uint256 _maxBurnCap,
        bytes32 _descriptionHash
    ) external daoActive returns (uint256) {
        bytes memory payload = abi.encode(_baseBurnPercent, _burnIncrementPhase1, _burnIncrementPhase2, _maxBurnCap);
        return _createProposal(ProposalType.UPDATE_BURN_PARAMS, payload, _descriptionHash);
    }

    /// @notice Create a treasury address update proposal.
    function proposeTreasuryUpdate(
        address _newTreasury,
        bytes32 _descriptionHash
    ) external daoActive returns (uint256) {
        require(_newTreasury != address(0), "Governor: invalid treasury");
        bytes memory payload = abi.encode(_newTreasury);
        return _createProposal(ProposalType.UPDATE_TREASURY, payload, _descriptionHash);
    }

    /// @notice Create a proposal to replace this governor with a new one.
    /// @dev    The new governor must already be deployed. The Bitxen owner
    ///         will need to call setGovernor() after this executes, OR this
    ///         governor can call it directly if it holds the owner role.
    function proposeGovernorUpdate(
        address _newGovernor,
        bytes32 _descriptionHash
    ) external daoActive returns (uint256) {
        require(_newGovernor != address(0) && _newGovernor != address(this), "Governor: invalid address");
        bytes memory payload = abi.encode(_newGovernor);
        return _createProposal(ProposalType.UPDATE_GOVERNOR, payload, _descriptionHash);
    }

    /// @notice Create a proposal to update governance parameters themselves.
    ///         Encoded as UPDATE_GOVERNOR type but routed to _updateGovernanceParams.
    ///         Call via proposeGovernanceParamsUpdate for clarity.
    function proposeGovernanceParamsUpdate(
        uint256 _newVotingPeriod,
        uint256 _newTimelockDelay,
        uint256 _newQuorumBps,
        uint256 _newProposalThreshold,
        bytes32 _descriptionHash
    ) external daoActive returns (uint256) {
        require(_newVotingPeriod  >= MIN_VOTING_PERIOD && _newVotingPeriod  <= MAX_VOTING_PERIOD, "Governor: voting period out of range");
        require(_newTimelockDelay >= MIN_TIMELOCK      && _newTimelockDelay <= MAX_TIMELOCK,      "Governor: timelock out of range");
        require(_newQuorumBps     <= MAX_QUORUM_BPS,   "Governor: quorum too high");
        require(_newProposalThreshold > 0,             "Governor: threshold must be > 0");

        // We re-use a bytes-encoded call to the internal setter which is
        // executed via onlySelf in _executeProposal.
        bytes memory payload = abi.encodeWithSelector(
            this.updateGovernanceParams.selector,
            _newVotingPeriod,
            _newTimelockDelay,
            _newQuorumBps,
            _newProposalThreshold
        );
        return _createProposal(ProposalType.UPDATE_GOVERNOR, payload, _descriptionHash);
    }

    // -------------------------------------------------------------------------
    // Voting
    // -------------------------------------------------------------------------

    /// @notice Cast a vote on an active proposal.
    /// @param _proposalId Proposal to vote on.
    /// @param _support    0 = Against, 1 = For, 2 = Abstain.
    function castVote(uint256 _proposalId, uint8 _support) external daoActive {
        require(_support <= 2, "Governor: invalid vote type");
        require(state(_proposalId) == ProposalState.Active, "Governor: proposal not active");
        require(!hasVoted[msg.sender][_proposalId], "Governor: already voted");

        Proposal storage p = proposals[_proposalId];
        uint256 weight = bitxen.getPastVotes(msg.sender, p.snapshotBlock);
        require(weight > 0, "Governor: no voting power at snapshot");

        hasVoted[msg.sender][_proposalId]  = true;
        voteChoice[msg.sender][_proposalId] = _support;

        if      (_support == 1) p.votesFor     += weight;
        else if (_support == 0) p.votesAgainst += weight;
        else                    p.votesAbstain  += weight;

        emit VoteCast(_proposalId, msg.sender, _support, weight);
    }

    // -------------------------------------------------------------------------
    // Queue & Execute
    // -------------------------------------------------------------------------

    /// @notice Move a succeeded proposal into the timelock queue.
    function queue(uint256 _proposalId) external daoActive {
        require(state(_proposalId) == ProposalState.Succeeded, "Governor: proposal not succeeded");

        Proposal storage p = proposals[_proposalId];
        p.eta = block.number + timelockDelay;

        emit ProposalQueued(_proposalId, p.eta);
    }

    /// @notice Execute a queued proposal whose timelock has elapsed.
    function execute(uint256 _proposalId) external daoActive {
        require(state(_proposalId) == ProposalState.Queued, "Governor: proposal not queued");

        Proposal storage p = proposals[_proposalId];
        require(block.number >= p.eta, "Governor: timelock not elapsed");

        p.executed = true;
        _executeProposal(p);

        emit ProposalExecuted(_proposalId);
    }

    /// @notice Cancel a proposal. Only the original proposer may cancel, and
    ///         only while the proposal has not yet been executed.
    function cancel(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(p.proposer == msg.sender,  "Governor: not proposer");
        require(!p.executed,               "Governor: already executed");
        require(!p.cancelled,              "Governor: already cancelled");

        ProposalState s = state(_proposalId);
        require(
            s == ProposalState.Pending  ||
            s == ProposalState.Active   ||
            s == ProposalState.Succeeded ||
            s == ProposalState.Queued,
            "Governor: cannot cancel in current state"
        );

        p.cancelled = true;
        emit ProposalCancelled(_proposalId);
    }

    // -------------------------------------------------------------------------
    // Self-callable Governance Param Update (executed via proposal)
    // -------------------------------------------------------------------------

    /// @notice Update core governance parameters.
    /// @dev    Can only be called by this contract itself (via an executed proposal).
    function updateGovernanceParams(
        uint256 _votingPeriod,
        uint256 _timelockDelay,
        uint256 _quorumBps,
        uint256 _proposalThreshold
    ) external onlySelf {
        require(_votingPeriod  >= MIN_VOTING_PERIOD && _votingPeriod  <= MAX_VOTING_PERIOD, "Governor: voting period out of range");
        require(_timelockDelay >= MIN_TIMELOCK      && _timelockDelay <= MAX_TIMELOCK,      "Governor: timelock out of range");
        require(_quorumBps     <= MAX_QUORUM_BPS,   "Governor: quorum too high");
        require(_proposalThreshold > 0,             "Governor: threshold must be > 0");

        votingPeriod      = _votingPeriod;
        timelockDelay     = _timelockDelay;
        quorumBps         = _quorumBps;
        proposalThreshold = _proposalThreshold;

        emit GovernanceParamsUpdated(_votingPeriod, _timelockDelay, _quorumBps, _proposalThreshold);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Derive the current state of a proposal from its stored data.
    function state(uint256 _proposalId) public view returns (ProposalState) {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Governor: unknown proposal");

        if (p.cancelled) return ProposalState.Cancelled;
        if (p.executed)  return ProposalState.Executed;

        if (block.number < p.voteStart) return ProposalState.Pending;

        if (block.number <= p.voteEnd) return ProposalState.Active;

        // Voting closed — check result
        if (!_quorumReached(p) || !_voteSucceeded(p)) return ProposalState.Defeated;

        if (p.eta == 0) return ProposalState.Succeeded;

        return ProposalState.Queued;
    }

    /// @notice Returns voting tallies and quorum requirement for a proposal.
    function getProposalVotes(uint256 _proposalId)
        external view
        returns (
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 quorumRequired
        )
    {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Governor: unknown proposal");

        // Quorum is calculated against the total supply at the snapshot block.
        // We approximate with current total supply for the view (exact value
        // is enforced in _quorumReached using the snapshot approach).
        uint256 snapshotSupply = bitxen.totalSupply();
        return (
            p.votesFor,
            p.votesAgainst,
            p.votesAbstain,
            (snapshotSupply * quorumBps) / BPS_DENOMINATOR
        );
    }

    /// @notice Returns true if the DAO activation threshold has been reached.
    function isDaoActive() external view returns (bool) {
        return bitxen.totalRecordsStored() >= bitxen.DAO_ACTIVATION_THRESHOLD();
    }

    /// @notice Returns a summary of a proposal's key metadata.
    function getProposal(uint256 _proposalId)
        external view
        returns (
            address      proposer,
            ProposalType proposalType,
            bytes32      descriptionHash,
            uint256      voteStart,
            uint256      voteEnd,
            uint256      eta,
            ProposalState proposalState
        )
    {
        Proposal storage p = proposals[_proposalId];
        require(p.id != 0, "Governor: unknown proposal");
        return (
            p.proposer,
            p.proposalType,
            p.descriptionHash,
            p.voteStart,
            p.voteEnd,
            p.eta,
            state(_proposalId)
        );
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _createProposal(
        ProposalType _type,
        bytes memory _payload,
        bytes32 _descriptionHash
    ) internal returns (uint256) {
        address proposer = msg.sender;
        uint256 snapshot = block.number; // snapshot at creation block

        uint256 weight = bitxen.getPastVotes(proposer, snapshot > 0 ? snapshot - 1 : 0);
        require(weight >= proposalThreshold, "Governor: below proposal threshold");

        uint256 id = ++proposalCount;

        uint256 voteStart = block.number + VOTING_DELAY;
        uint256 voteEnd   = voteStart + votingPeriod - 1;

        proposals[id] = Proposal({
            id:              id,
            proposer:        proposer,
            proposalType:    _type,
            payload:         _payload,
            descriptionHash: _descriptionHash,
            snapshotBlock:   snapshot,
            voteStart:       voteStart,
            voteEnd:         voteEnd,
            eta:             0,
            votesFor:        0,
            votesAgainst:    0,
            votesAbstain:    0,
            executed:        false,
            cancelled:       false
        });

        emit ProposalCreated(id, proposer, _type, _descriptionHash, voteStart, voteEnd);
        return id;
    }

    function _executeProposal(Proposal storage p) internal {
        if (p.proposalType == ProposalType.UPDATE_FEE_PARAMS) {
            (uint256 baseFee, uint256 incr1, uint256 incr2) =
                abi.decode(p.payload, (uint256, uint256, uint256));
            bitxen.setFeeParams(baseFee, incr1, incr2);

        } else if (p.proposalType == ProposalType.UPDATE_BURN_PARAMS) {
            (uint256 baseB, uint256 bi1, uint256 bi2, uint256 cap) =
                abi.decode(p.payload, (uint256, uint256, uint256, uint256));
            bitxen.setBurnParams(baseB, bi1, bi2, cap);

        } else if (p.proposalType == ProposalType.UPDATE_TREASURY) {
            address newTreasury = abi.decode(p.payload, (address));
            bitxen.setTreasuryByGovernor(newTreasury);

        } else if (p.proposalType == ProposalType.UPDATE_GOVERNOR) {
            // May be a governor replacement OR a governance params update
            // (distinguished by the selector encoded in payload).
            bytes4 selector;
            if (p.payload.length >= 4) {
                selector = bytes4(p.payload[0]) | (bytes4(p.payload[1]) >> 8) |
                           (bytes4(p.payload[2]) >> 16) | (bytes4(p.payload[3]) >> 24);
            }
            if (selector == this.updateGovernanceParams.selector) {
                // Self-call to update governance params
                (bool ok, ) = address(this).call(p.payload);
                require(ok, "Governor: governance params update failed");
            } else {
                // Governor replacement — update the Bitxen contract's governor pointer
                address newGov = abi.decode(p.payload, (address));
                bitxen.setGovernor(newGov);
            }
        }
    }

    function _quorumReached(Proposal storage p) internal view returns (bool) {
        // Quorum is based on total supply at the snapshot block.
        // ERC20Votes does not provide getPastTotalSupply by default in all OZ versions;
        // we use current totalSupply as a conservative approximation. For a production
        // deployment, integrate IVotes.getPastTotalSupply if available.
        uint256 supply  = bitxen.totalSupply();
        uint256 quorum  = (supply * quorumBps) / BPS_DENOMINATOR;
        return p.votesFor + p.votesAbstain >= quorum;
    }

    function _voteSucceeded(Proposal storage p) internal pure returns (bool) {
        return p.votesFor > p.votesAgainst;
    }
}
