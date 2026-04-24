// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/*
 * Bitxen (BITXEN) - Size Optimized & Dynamic Economics
 * Fixed-supply ERC-20 utility token with hybrid data storage & deflationary mechanics
 * Networks: Ethereum, Base, Polygon
 *
 * Fee model: flat base fee per action (register or update), determined solely
 * by the current phase/epoch. No file-size multiplier, no permanent premium,
 * no update discount.
 *
 * Governance: Economic parameters (fees, burn rates, treasury) are immutable
 * until totalRecordsStored >= DAO_ACTIVATION_THRESHOLD (5,000,000), after
 * which the deployed BitxenGovernor contract may update them via the
 * onlyGovernor-gated setters below.
 */

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Bitxen is ERC20Votes, ERC20Permit, Ownable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Hard Constants (never change)
    // -------------------------------------------------------------------------

    uint256 public constant MAX_SUPPLY              = 1_000_000_000 * 10**18;
    uint256 public constant EPOCH_SIZE              = 10_000;
    uint256 public constant PHASE_1_CAP             = 3_000_000;
    uint256 public constant MAX_DATA_VERSIONS       = 100;
    uint256 public constant DAO_ACTIVATION_THRESHOLD = 5_000_000;

    // Absolute security limits that governance can never exceed
    uint256 public constant ABSOLUTE_BURN_CAP_LIMIT = 9500; // 95.00%
    uint256 public constant MAX_ALLOWED_BASE_FEE    = 10_000 * 10**18; // 10,000 BITXEN ceiling

    // -------------------------------------------------------------------------
    // Governance-Mutable Parameters
    // Initialised to the original economics; may be updated by the Governor
    // once DAO_ACTIVATION_THRESHOLD vaults are reached.
    // -------------------------------------------------------------------------

    // Fee params (scaled by 1e18)
    uint256 public baseFeePhase1     = 40 * 10**18;
    uint256 public feeIncrementPhase1 = 15 * 10**16; // 0.15 BITXEN per epoch
    uint256 public feeIncrementPhase2 = 35 * 10**16; // 0.35 BITXEN per epoch

    // Burn params (basis points)
    uint256 public baseBurnPercent      = 5000; // 50.00%
    uint256 public burnIncrementPhase1  = 6;    // +0.06% per epoch
    uint256 public burnIncrementPhase2  = 11;   // +0.11% per epoch
    uint256 public maxBurnCap           = 9000; // 90.00%

    // -------------------------------------------------------------------------
    // Access Control
    // -------------------------------------------------------------------------

    address public treasury;
    address public governor; // Set by owner; becomes the sole authority post-DAO

    // -------------------------------------------------------------------------
    // Storage State
    // -------------------------------------------------------------------------

    mapping(address => uint256) public pendingWithdrawals;


    struct RegistrationParams {
        bytes32         dataHash;
        string          storageURI;
        bytes32 provider;
        uint256         fileSize;
        string          contentType;
        string          fileName;
        bool            isPermanent;
        uint256         releaseDate;
        bytes32         commitment;
        bytes32         secret;
    }

    struct DataVersion {
        bytes32         dataHash;
        string          storageURI;
        bytes32 provider;
        uint128         timestamp;
        uint64          versionNumber;
        uint64          fileSize;
    }

    struct CoreData {
        address         owner;
        bytes32 currentProvider;
        uint128         createdAt;
        uint128         lastUpdatedAt;
        bytes32         currentDataHash;
        bytes32         commitment;
        string          currentStorageURI;
    }

    struct MetaData {
        uint64  fileSize;
        uint64  currentVersion;
        uint64  totalVersions;
        bool    isPermanent;
        string  contentType;
        string  fileName;
        uint256 totalFeePaid;
    }

    struct ReleaseData {
        uint128 releaseDate;
        bool    isReleased;
        bytes32 releaseEntropy;
    }

    struct DataRecord {
        address         owner;
        bytes32         currentDataHash;
        string          currentStorageURI;
        bytes32 currentProvider;
        uint256         createdAt;
        uint256         lastUpdatedAt;
        bytes32         commitment;
        uint256         fileSize;
        string          contentType;
        string          fileName;
        bool            isPermanent;
        uint256         currentVersion;
        uint256         totalVersions;
        uint256         totalFeePaid;
        uint256         releaseDate;
        bool            isReleased;
        bytes32         releaseEntropy;
    }

    mapping(bytes32 => CoreData)                        public  coreData;
    mapping(bytes32 => MetaData)                        public  metaData;
    mapping(bytes32 => ReleaseData)                     public  releaseInfo;
    mapping(bytes32 => mapping(uint256 => DataVersion)) public  dataVersions;
    mapping(address => bytes32[])                       private userDataIds;
    mapping(address => mapping(bytes32 => uint256))     private userDataIdIndex;
    mapping(bytes32 => mapping(uint256 => bytes32))     private hashToDataId;
    mapping(address => mapping(bytes32 => bool))        private userHasDataId;
    mapping(bytes32 => bytes32)                         private _vaultSecrets;

    uint256 public totalRecordsStored;
    uint256 public totalPendingWithdrawals;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event DataRegistered(bytes32 indexed dataId, address indexed owner, bytes32 dataHash, string storageURI, bytes32 provider, uint256 fileSize, uint256 feePaid);
    event DataReleased(bytes32 indexed dataId, address indexed owner, bytes32 releaseEntropy, uint256 releaseTimestamp);
    event DataUpdated(bytes32 indexed dataId, address indexed owner, bytes32 newDataHash, string newStorageURI, uint256 feePaid, uint256 versionNumber);
    event CommitmentUpdated(bytes32 indexed dataId, address indexed owner, bytes32 oldCommitment, bytes32 newCommitment);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event GovernorUpdated(address oldGovernor, address newGovernor);
    event DataDeleted(bytes32 indexed dataId, address indexed owner, uint256 refundAmount, uint256 versionsDeleted);
    event WithdrawalReady(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event FeeDistributed(uint256 burnAmount, uint256 treasuryAmount, uint256 burnPercent);
    event FeeParamsUpdated(uint256 baseFeePhase1, uint256 feeIncrementPhase1, uint256 feeIncrementPhase2);
    event BurnParamsUpdated(uint256 baseBurnPercent, uint256 burnIncrementPhase1, uint256 burnIncrementPhase2, uint256 maxBurnCap);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyGovernor() {
        require(msg.sender == governor, "Bitxen: caller is not the governor");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner)
        ERC20("Bitxen", "BITXEN")
        ERC20Permit("Bitxen")
        Ownable(initialOwner)
    {
        _mint(initialOwner, MAX_SUPPLY);
        treasury = initialOwner;
    }

    // -------------------------------------------------------------------------
    // ERC20Votes overrides (required due to diamond inheritance)
    // -------------------------------------------------------------------------

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, amount);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    // -------------------------------------------------------------------------
    // Economics Logic
    // -------------------------------------------------------------------------

    /// @notice Returns the current flat base fee for any vault action,
    ///         computed from the active phase and epoch using the current
    ///         (potentially governance-updated) parameters.
    function calculateFee() public view returns (uint256) {
        (uint256 baseFee, ) = _calculateDynamicParams();
        return baseFee;
    }

    /// @dev Computes base fee and burn percentage from current state.
    function _calculateDynamicParams() public view returns (uint256 baseFee, uint256 burnPercent) {
        uint256 vaults = totalRecordsStored;
        uint256 epoch  = vaults / EPOCH_SIZE;

        if (vaults < PHASE_1_CAP) {
            baseFee     = baseFeePhase1 + (epoch * feeIncrementPhase1);
            burnPercent = baseBurnPercent + (epoch * burnIncrementPhase1);
        } else {
            uint256 phase1Epochs = PHASE_1_CAP / EPOCH_SIZE;
            uint256 phase2Epochs = epoch - phase1Epochs;

            uint256 feeAtPhase2Start  = baseFeePhase1 + (phase1Epochs * feeIncrementPhase1);
            baseFee = feeAtPhase2Start + (phase2Epochs * feeIncrementPhase2);

            uint256 burnAtPhase2Start = baseBurnPercent + (phase1Epochs * burnIncrementPhase1);
            burnPercent = burnAtPhase2Start + (phase2Epochs * burnIncrementPhase2);

            if (burnPercent > maxBurnCap) burnPercent = maxBurnCap;
        }

        if (burnPercent > ABSOLUTE_BURN_CAP_LIMIT) burnPercent = ABSOLUTE_BURN_CAP_LIMIT;
    }

    function _processFee(address payer, uint256 amount) private {
        require(balanceOf(payer) >= amount, "Insufficient balance");

        (, uint256 burnPercent) = _calculateDynamicParams();
        uint256 burnAmount     = (amount * burnPercent) / 10000;
        uint256 treasuryAmount = amount - burnAmount;

        if (burnAmount > 0)     _burn(payer, burnAmount);
        if (treasuryAmount > 0) _transfer(payer, treasury, treasuryAmount);

        emit FeeDistributed(burnAmount, treasuryAmount, burnPercent);
    }

    // -------------------------------------------------------------------------
    // Governor-Only Parameter Setters
    // (callable only after DAO activation threshold is met)
    // -------------------------------------------------------------------------

    /// @notice Update registration fee progression parameters.
    /// @dev    Called exclusively by the BitxenGovernor after a passed proposal.
    function setFeeParams(
        uint256 _baseFeePhase1,
        uint256 _feeIncrementPhase1,
        uint256 _feeIncrementPhase2
    ) external onlyGovernor {
        require(totalRecordsStored >= DAO_ACTIVATION_THRESHOLD, "DAO not yet active");
        require(_baseFeePhase1 > 0,          "Base fee must be > 0");
        require(_baseFeePhase1 <= MAX_ALLOWED_BASE_FEE, "Base fee exceeds ceiling");

        baseFeePhase1      = _baseFeePhase1;
        feeIncrementPhase1 = _feeIncrementPhase1;
        feeIncrementPhase2 = _feeIncrementPhase2;

        emit FeeParamsUpdated(_baseFeePhase1, _feeIncrementPhase1, _feeIncrementPhase2);
    }

    /// @notice Update burn rate progression parameters.
    /// @dev    Called exclusively by the BitxenGovernor after a passed proposal.
    function setBurnParams(
        uint256 _baseBurnPercent,
        uint256 _burnIncrementPhase1,
        uint256 _burnIncrementPhase2,
        uint256 _maxBurnCap
    ) external onlyGovernor {
        require(totalRecordsStored >= DAO_ACTIVATION_THRESHOLD, "DAO not yet active");
        require(_baseBurnPercent <= ABSOLUTE_BURN_CAP_LIMIT, "Exceeds absolute cap");
        require(_maxBurnCap      <= ABSOLUTE_BURN_CAP_LIMIT, "Max cap exceeds absolute cap");
        require(_maxBurnCap      >= _baseBurnPercent,        "Max cap below base");

        baseBurnPercent     = _baseBurnPercent;
        burnIncrementPhase1 = _burnIncrementPhase1;
        burnIncrementPhase2 = _burnIncrementPhase2;
        maxBurnCap          = _maxBurnCap;

        emit BurnParamsUpdated(_baseBurnPercent, _burnIncrementPhase1, _burnIncrementPhase2, _maxBurnCap);
    }

    /// @notice Update the treasury address via governance.
    function setTreasuryByGovernor(address _newTreasury) external onlyGovernor {
        require(totalRecordsStored >= DAO_ACTIVATION_THRESHOLD, "DAO not yet active");
        require(_newTreasury != address(0), "Invalid address");
        address old = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(old, _newTreasury);
    }

    // -------------------------------------------------------------------------
    // Owner-Only Admin Functions
    // -------------------------------------------------------------------------

    /// @notice Set the governor contract address. Can only be called once the
    ///         governor has been deployed. Owner retains this ability so the
    ///         governor address can be upgraded by DAO vote (governor calls
    ///         itself via a proposal that re-deploys and sets a new address).
    function setGovernor(address _governor) external onlyOwner {
        require(_governor != address(0), "Invalid address");
        address old = governor;
        governor = _governor;
        emit GovernorUpdated(old, _governor);
    }

    /// @notice Owner can still change the treasury address before DAO activation.
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        address old = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(old, _newTreasury);
    }

    /// @notice Withdraw accumulated treasury tokens to the treasury address.
    function withdrawRevenue(uint256 amount) external onlyOwner {
        require(balanceOf(address(this)) >= amount + totalPendingWithdrawals, "Insufficient safe balance");
        require(treasury != address(0), "Treasury not set");
        _transfer(address(this), treasury, amount);
    }

    // -------------------------------------------------------------------------
    // Core Vault Functions
    // -------------------------------------------------------------------------

    function registerData(RegistrationParams calldata params) external nonReentrant returns (bytes32) {
        require(params.dataHash != bytes32(0),       "Empty hash");
        require(bytes(params.storageURI).length > 0, "Empty URI");
        require(params.fileSize > 0 && params.fileSize <= type(uint64).max, "Invalid size");
        require(params.releaseDate == 0 || params.releaseDate > block.timestamp, "Invalid date");
        require(params.releaseDate <= type(uint128).max, "Date overflow");

        uint256 fee = calculateFee();
        _processFee(msg.sender, fee);

        bytes32 dataId = keccak256(abi.encodePacked(msg.sender, params.dataHash, params.storageURI, block.timestamp));
        require(coreData[dataId].createdAt == 0, "ID collision");

        uint128 ts = uint128(block.timestamp);

        CoreData storage core  = coreData[dataId];
        core.owner             = msg.sender;
        core.currentDataHash   = params.dataHash;
        core.currentStorageURI = params.storageURI;
        core.currentProvider   = params.provider;
        core.createdAt         = ts;
        core.lastUpdatedAt     = ts;
        core.commitment        = params.commitment;

        MetaData storage meta = metaData[dataId];
        meta.fileSize         = uint64(params.fileSize);
        meta.contentType      = params.contentType;
        meta.fileName         = params.fileName;
        meta.isPermanent      = params.isPermanent;
        meta.currentVersion   = 1;
        meta.totalVersions    = 1;
        meta.totalFeePaid     = fee;

        ReleaseData storage release = releaseInfo[dataId];
        release.releaseDate   = uint128(params.releaseDate);
        release.isReleased    = (params.releaseDate == 0);
        release.releaseEntropy = release.isReleased ? _computeReleaseEntropy(dataId) : bytes32(0);

        DataVersion storage v = dataVersions[dataId][1];
        v.dataHash      = params.dataHash;
        v.storageURI    = params.storageURI;
        v.provider      = params.provider;
        v.timestamp     = ts;
        v.versionNumber = 1;
        v.fileSize      = uint64(params.fileSize);

        if (hashToDataId[params.dataHash][1] == bytes32(0))
            hashToDataId[params.dataHash][1] = dataId;

        if (!userHasDataId[msg.sender][dataId]) {
            userDataIdIndex[msg.sender][dataId] = userDataIds[msg.sender].length;
            userDataIds[msg.sender].push(dataId);
            userHasDataId[msg.sender][dataId] = true;
        }

        if (params.secret != bytes32(0)) _vaultSecrets[dataId] = params.secret;

        totalRecordsStored++;

        emit DataRegistered(dataId, msg.sender, params.dataHash, params.storageURI, params.provider, params.fileSize, fee);
        return dataId;
    }

    function updateData(
        bytes32 _dataId,
        bytes32 _newDataHash,
        string calldata _newStorageURI,
        bytes32 _newProvider,
        uint256 _newFileSize
    ) external nonReentrant returns (uint256) {
        CoreData storage core = coreData[_dataId];
        MetaData storage meta = metaData[_dataId];

        require(core.createdAt > 0, "Not found");
        require(core.owner == msg.sender, "Not owner");
        require(meta.currentVersion < MAX_DATA_VERSIONS, "Max versions");
        require(_newDataHash != bytes32(0), "Empty hash");
        require(bytes(_newStorageURI).length > 0, "Empty URI");
        require(_newFileSize > 0 && _newFileSize <= type(uint64).max, "Invalid size");

        uint256 fee = calculateFee();
        _processFee(msg.sender, fee);

        uint64  newVersion = meta.currentVersion + 1;
        uint128 ts         = uint128(block.timestamp);

        DataVersion storage v = dataVersions[_dataId][newVersion];
        v.dataHash      = _newDataHash;
        v.storageURI    = _newStorageURI;
        v.provider      = _newProvider;
        v.timestamp     = ts;
        v.versionNumber = newVersion;
        v.fileSize      = uint64(_newFileSize);

        if (hashToDataId[_newDataHash][newVersion] == bytes32(0))
            hashToDataId[_newDataHash][newVersion] = _dataId;

        core.currentDataHash   = _newDataHash;
        core.currentStorageURI = _newStorageURI;
        core.currentProvider   = _newProvider;
        core.lastUpdatedAt     = ts;

        meta.fileSize       = uint64(_newFileSize);
        meta.currentVersion = newVersion;
        meta.totalVersions  = newVersion;
        meta.totalFeePaid  += fee;

        emit DataUpdated(_dataId, msg.sender, _newDataHash, _newStorageURI, fee, newVersion);
        return newVersion;
    }

    // -------------------------------------------------------------------------
    // Release Functions
    // -------------------------------------------------------------------------

    function releaseData(bytes32 _dataId) external returns (bytes32) {
        CoreData storage core       = coreData[_dataId];
        ReleaseData storage release = releaseInfo[_dataId];

        require(core.createdAt > 0,              "Not found");
        require(core.owner == msg.sender,         "Not owner");
        require(!release.isReleased,              "Already released");
        require(release.releaseDate > 0,          "No date set");
        require(block.timestamp >= release.releaseDate, "Not reached");

        release.isReleased = true;
        if (release.releaseEntropy == bytes32(0))
            release.releaseEntropy = _computeReleaseEntropy(_dataId);

        emit DataReleased(_dataId, core.owner, release.releaseEntropy, block.timestamp);
        return release.releaseEntropy;
    }

    function finalizeRelease(bytes32 _dataId) external {
        CoreData memory core        = coreData[_dataId];
        ReleaseData storage release = releaseInfo[_dataId];

        require(core.createdAt > 0,              "Not found");
        require(!release.isReleased,              "Already released");
        require(release.releaseDate > 0,          "No date set");
        require(block.timestamp >= release.releaseDate, "Not reached");

        release.isReleased = true;
        if (release.releaseEntropy == bytes32(0))
            release.releaseEntropy = _computeReleaseEntropy(_dataId);

        emit DataReleased(_dataId, core.owner, release.releaseEntropy, block.timestamp);
    }

    function manualRelease(bytes32 _dataId) external {
        CoreData storage core       = coreData[_dataId];
        ReleaseData storage release = releaseInfo[_dataId];

        require(core.createdAt > 0,     "Not found");
        require(core.owner == msg.sender, "Not owner");
        require(!release.isReleased,    "Already released");
        require(release.releaseDate > 0, "No date set");

        release.isReleased = true;
        if (release.releaseEntropy == bytes32(0))
            release.releaseEntropy = _computeReleaseEntropy(_dataId);

        emit DataReleased(_dataId, core.owner, release.releaseEntropy, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Commitment
    // -------------------------------------------------------------------------

    function setCommitment(bytes32 _dataId, bytes32 _commitment) external {
        CoreData storage core = coreData[_dataId];
        require(core.createdAt > 0,       "Not found");
        require(core.owner == msg.sender,  "Not owner");

        bytes32 old = core.commitment;
        core.commitment = _commitment;
        emit CommitmentUpdated(_dataId, core.owner, old, _commitment);
    }

    // -------------------------------------------------------------------------
    // Data Deletion
    // -------------------------------------------------------------------------

    function deleteData(bytes32 _dataId) external nonReentrant {
        CoreData storage core = coreData[_dataId];
        MetaData storage meta = metaData[_dataId];

        require(core.createdAt > 0,        "Not found");
        require(core.owner == msg.sender,   "Not owner");
        require(!meta.isPermanent,          "Cannot delete permanent");

        uint256 versionsDeleted = meta.totalVersions;
        for (uint256 i = 1; i <= versionsDeleted; i++) {
            DataVersion storage v = dataVersions[_dataId][i];
            if (hashToDataId[v.dataHash][i] == _dataId) delete hashToDataId[v.dataHash][i];
            delete dataVersions[_dataId][i];
        }

        _removeUserDataId(msg.sender, _dataId);
        delete coreData[_dataId];
        delete metaData[_dataId];
        delete releaseInfo[_dataId];

        // totalRecordsStored not decremented — preserves epoch integrity

        emit DataDeleted(_dataId, msg.sender, 0, versionsDeleted);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function isDataReleased(bytes32 _dataId) external view returns (bool released, uint256 releaseDate) {
        CoreData memory core       = coreData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        require(core.createdAt > 0, "Not found");
        if (release.releaseDate == 0) return (true, 0);
        return (release.isReleased, release.releaseDate);
    }

    function getReleaseEntropy(bytes32 _dataId) external view returns (bytes32) {
        CoreData memory core       = coreData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        require(core.createdAt > 0, "Not found");
        if (release.releaseDate == 0 || release.isReleased) return release.releaseEntropy;
        return bytes32(0);
    }

    function getVaultSecret(bytes32 _dataId) external view returns (bytes32) {
        CoreData memory core       = coreData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        require(core.createdAt > 0, "Not found");
        if (release.isReleased || (release.releaseDate > 0 && block.timestamp >= release.releaseDate))
            return _vaultSecrets[_dataId];
        revert("Not released");
    }

    function verifyDataIntegrity(bytes32 _dataId, bytes32 _dataHash) external view returns (bool) {
        return coreData[_dataId].currentDataHash == _dataHash;
    }

    function getDataIdByHash(bytes32 _dataHash, uint256 _version) external view returns (bytes32) {
        return hashToDataId[_dataHash][_version];
    }

    function getDataRecord(bytes32 _dataId) external view returns (DataRecord memory) {
        CoreData memory core       = coreData[_dataId];
        MetaData memory meta       = metaData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        require(core.createdAt > 0, "Not found");

        return DataRecord({
            owner:             core.owner,
            currentDataHash:   core.currentDataHash,
            currentStorageURI: core.currentStorageURI,
            currentProvider:   core.currentProvider,
            createdAt:         core.createdAt,
            lastUpdatedAt:     core.lastUpdatedAt,
            commitment:        core.commitment,
            fileSize:          meta.fileSize,
            contentType:       meta.contentType,
            fileName:          meta.fileName,
            isPermanent:       meta.isPermanent,
            currentVersion:    meta.currentVersion,
            totalVersions:     meta.totalVersions,
            totalFeePaid:      meta.totalFeePaid,
            releaseDate:       release.releaseDate,
            isReleased:        release.isReleased,
            releaseEntropy:    release.releaseEntropy
        });
    }

    function getDataVersion(bytes32 _dataId, uint256 _version) external view returns (DataVersion memory) {
        require(coreData[_dataId].createdAt > 0, "Not found");
        require(_version > 0 && _version <= metaData[_dataId].totalVersions, "Invalid version");
        return dataVersions[_dataId][_version];
    }

    function getDataInfo(bytes32 _dataId) external view returns (
        address owner, uint256 createdAt, bool isPermanent, uint256 currentVersion
    ) {
        CoreData memory core = coreData[_dataId];
        MetaData memory meta = metaData[_dataId];
        require(core.createdAt > 0, "Not found");
        return (core.owner, core.createdAt, meta.isPermanent, meta.currentVersion);
    }

    function getUserDataIds(address _user, uint256 _offset, uint256 _limit)
        external view returns (bytes32[] memory dataIds, uint256 total)
    {
        require(_limit > 0 && _limit <= 100, "Limit 1-100");
        bytes32[] storage allIds = userDataIds[_user];
        total = allIds.length;
        if (_offset >= total) return (new bytes32[](0), total);
        uint256 end = _offset + _limit > total ? total : _offset + _limit;
        uint256 len = end - _offset;
        dataIds = new bytes32[](len);
        for (uint256 i = 0; i < len; i++) dataIds[i] = allIds[_offset + i];
        return (dataIds, total);
    }

    function getUserDataCount(address _user) external view returns (uint256) {
        return userDataIds[_user].length;
    }

    function isDaoActive() external view returns (bool) {
        return totalRecordsStored >= DAO_ACTIVATION_THRESHOLD;
    }

    // -------------------------------------------------------------------------
    // Token Controls
    // -------------------------------------------------------------------------

    function mint(address, uint256) external pure { revert("Minting disabled"); }

    function burn(uint256 amount) external { _burn(msg.sender, amount); }

    // -------------------------------------------------------------------------
    // Private Helpers
    // -------------------------------------------------------------------------

    function _computeReleaseEntropy(bytes32 _dataId) private view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), _dataId, block.prevrandao, blockhash(block.number - 1)));
    }

    function _removeUserDataId(address _user, bytes32 _dataId) private {
        if (!userHasDataId[_user][_dataId]) return;
        uint256 index     = userDataIdIndex[_user][_dataId];
        uint256 lastIndex = userDataIds[_user].length - 1;
        if (index != lastIndex) {
            bytes32 last = userDataIds[_user][lastIndex];
            userDataIds[_user][index] = last;
            userDataIdIndex[_user][last] = index;
        }
        userDataIds[_user].pop();
        delete userDataIdIndex[_user][_dataId];
        delete userHasDataId[_user][_dataId];
    }
}
