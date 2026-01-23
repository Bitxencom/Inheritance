// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/*
 * Bitxen (BITXEN) - Size Optimized
 * Fixed-supply ERC-20 utility token with hybrid data storage
 * Networks: Ethereum, Base, Polygon
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Bitxen is ERC20, Ownable, ReentrancyGuard {
    
    uint256 public constant MAX_REGISTRATION_FEE = 1000 * 10**18;
    uint256 public constant MAX_UPDATE_FEE = 500 * 10**18;
    uint256 public constant MAX_REFUND_PERCENTAGE = 10000;
    
    uint256 public registrationFee;
    uint256 public updateFee;
    uint256 public refundPercentage;
    address public treasury;
    
    mapping(address => uint256) public pendingWithdrawals;
    
    enum StorageProvider { IPFS, ARWEAVE, CUSTOM }
    
    struct RegistrationParams {
        bytes32 dataHash;
        string storageURI;
        StorageProvider provider;
        uint256 fileSize;
        string contentType;
        string fileName;
        bool isPermanent;
        uint256 releaseDate;
        string encryptedKey;
    }
    
    struct DataVersion {
        bytes32 dataHash;
        string storageURI;
        StorageProvider provider;
        uint128 timestamp;
        uint64 versionNumber;
        uint64 fileSize;
    }
    
    struct CoreData {
        address owner;
        bytes32 currentDataHash;
        string currentStorageURI;
        StorageProvider currentProvider;
        uint128 createdAt;
        uint128 lastUpdatedAt;
    }
    
    struct MetaData {
        uint64 fileSize;
        uint64 currentVersion;
        uint64 totalVersions;
        bool isPermanent;
        string contentType;
        string fileName;
        uint256 totalFeePaid;
    }
    
    struct ReleaseData {
        uint128 releaseDate;
        bool isReleased;
        string encryptedKey;
    }
    
    struct DataRecord {
        address owner;
        bytes32 currentDataHash;
        string currentStorageURI;
        StorageProvider currentProvider;
        uint256 createdAt;
        uint256 lastUpdatedAt;
        uint256 fileSize;
        string contentType;
        string fileName;
        bool isPermanent;
        uint256 currentVersion;
        uint256 totalVersions;
        uint256 totalFeePaid;
        uint256 releaseDate;
        bool isReleased;
        string encryptedKey;
    }
    
    mapping(bytes32 => CoreData) public coreData;
    mapping(bytes32 => MetaData) public metaData;
    mapping(bytes32 => ReleaseData) public releaseInfo;
    mapping(bytes32 => mapping(uint256 => DataVersion)) public dataVersions;
    mapping(address => bytes32[]) private userDataIds;
    mapping(address => mapping(bytes32 => uint256)) private userDataIdIndex;
    mapping(bytes32 => mapping(uint256 => bytes32)) private hashToDataId;
    mapping(address => mapping(bytes32 => bool)) private userHasDataId;
    
    uint256 public totalRecordsStored;
    
    event DataRegistered(bytes32 indexed dataId, address indexed owner, bytes32 dataHash, string storageURI, StorageProvider provider, uint256 fileSize, uint256 feePaid);
    event DataReleased(bytes32 indexed dataId, address indexed owner, string decryptionKey, uint256 releaseTimestamp);
    event DataUpdated(bytes32 indexed dataId, address indexed owner, bytes32 newDataHash, string newStorageURI, uint256 feePaid, uint256 versionNumber);
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee);
    event UpdateFeeUpdated(uint256 oldFee, uint256 newFee);
    event RefundPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event DataDeleted(bytes32 indexed dataId, address indexed owner, uint256 refundAmount, uint256 versionsDeleted);
    event WithdrawalReady(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    
    constructor(address initialOwner, uint256 _registrationFee, uint256 _updateFee, uint256 _refundPercentage) 
        ERC20("Bitxen", "BITXEN") 
        Ownable(initialOwner) 
    {
        require(_registrationFee <= MAX_REGISTRATION_FEE, "Fee exceeds max");
        require(_updateFee <= MAX_UPDATE_FEE, "Fee exceeds max");
        require(_refundPercentage <= MAX_REFUND_PERCENTAGE, "Refund exceeds 100%");
        
        _mint(initialOwner, 1_000_000_000 * 10 ** decimals());
        
        registrationFee = _registrationFee;
        updateFee = _updateFee;
        refundPercentage = _refundPercentage;
        treasury = initialOwner;
    }
    
    function registerData(RegistrationParams calldata params) external nonReentrant returns (bytes32) {
        require(params.dataHash != bytes32(0), "Empty hash");
        require(bytes(params.storageURI).length > 0, "Empty URI");
        require(params.fileSize > 0 && params.fileSize <= type(uint64).max, "Invalid size");
        require(params.releaseDate == 0 || params.releaseDate > block.timestamp, "Invalid date");
        require(params.releaseDate <= type(uint128).max, "Date overflow");
        
        uint256 fee = calculateRegistrationFee(params.isPermanent);
        require(balanceOf(msg.sender) >= fee, "Insufficient balance");
        
        bytes32 dataId = keccak256(abi.encodePacked(msg.sender, params.dataHash, params.storageURI, block.timestamp));
        require(coreData[dataId].createdAt == 0, "ID collision");
        
        uint128 timestamp = uint128(block.timestamp);
        
        _transfer(msg.sender, treasury, fee);
        
        CoreData storage core = coreData[dataId];
        core.owner = msg.sender;
        core.currentDataHash = params.dataHash;
        core.currentStorageURI = params.storageURI;
        core.currentProvider = params.provider;
        core.createdAt = timestamp;
        core.lastUpdatedAt = timestamp;
        
        MetaData storage meta = metaData[dataId];
        meta.fileSize = uint64(params.fileSize);
        meta.contentType = params.contentType;
        meta.fileName = params.fileName;
        meta.isPermanent = params.isPermanent;
        meta.currentVersion = 1;
        meta.totalVersions = 1;
        meta.totalFeePaid = fee;
        
        ReleaseData storage release = releaseInfo[dataId];
        release.releaseDate = uint128(params.releaseDate);
        release.isReleased = (params.releaseDate == 0);
        release.encryptedKey = params.encryptedKey;
        
        DataVersion storage version = dataVersions[dataId][1];
        version.dataHash = params.dataHash;
        version.storageURI = params.storageURI;
        version.provider = params.provider;
        version.timestamp = timestamp;
        version.versionNumber = 1;
        version.fileSize = uint64(params.fileSize);
        
        hashToDataId[params.dataHash][1] = dataId;
        
        if (!userHasDataId[msg.sender][dataId]) {
            userDataIdIndex[msg.sender][dataId] = userDataIds[msg.sender].length;
            userDataIds[msg.sender].push(dataId);
            userHasDataId[msg.sender][dataId] = true;
        }
        
        totalRecordsStored++;
        
        emit DataRegistered(dataId, msg.sender, params.dataHash, params.storageURI, params.provider, params.fileSize, fee);
        
        return dataId;
    }
    
    function updateData(bytes32 _dataId, bytes32 _newDataHash, string calldata _newStorageURI, StorageProvider _newProvider, uint256 _newFileSize) 
        external nonReentrant returns (uint256) 
    {
        CoreData storage core = coreData[_dataId];
        MetaData storage meta = metaData[_dataId];
        
        require(core.createdAt > 0, "Not found");
        require(core.owner == msg.sender, "Not owner");
        require(_newDataHash != bytes32(0), "Empty hash");
        require(bytes(_newStorageURI).length > 0, "Empty URI");
        require(_newFileSize > 0 && _newFileSize <= type(uint64).max, "Invalid size");
        
        uint256 fee = calculateUpdateFee(meta.isPermanent);
        require(balanceOf(msg.sender) >= fee, "Insufficient balance");
        
        uint64 newVersion = meta.currentVersion + 1;
        uint128 timestamp = uint128(block.timestamp);
        
        _transfer(msg.sender, treasury, fee);
        
        DataVersion storage version = dataVersions[_dataId][newVersion];
        version.dataHash = _newDataHash;
        version.storageURI = _newStorageURI;
        version.provider = _newProvider;
        version.timestamp = timestamp;
        version.versionNumber = newVersion;
        version.fileSize = uint64(_newFileSize);
        
        hashToDataId[_newDataHash][newVersion] = _dataId;
        
        core.currentDataHash = _newDataHash;
        core.currentStorageURI = _newStorageURI;
        core.currentProvider = _newProvider;
        core.lastUpdatedAt = timestamp;
        
        meta.fileSize = uint64(_newFileSize);
        meta.currentVersion = newVersion;
        meta.totalVersions = newVersion;
        meta.totalFeePaid += fee;
        
        emit DataUpdated(_dataId, msg.sender, _newDataHash, _newStorageURI, fee, newVersion);
        
        return newVersion;
    }
    
    function calculateRegistrationFee(bool _isPermanent) public view returns (uint256) {
        return _isPermanent ? registrationFee * 10 : registrationFee;
    }
    
    function calculateUpdateFee(bool _isPermanent) public view returns (uint256) {
        return _isPermanent ? updateFee * 5 : updateFee;
    }
    
    function releaseData(bytes32 _dataId) external returns (string memory) {
        CoreData storage core = coreData[_dataId];
        ReleaseData storage release = releaseInfo[_dataId];
        
        require(core.createdAt > 0, "Not found");
        require(core.owner == msg.sender, "Not owner");
        require(!release.isReleased, "Already released");
        require(release.releaseDate > 0, "No date set");
        require(block.timestamp >= release.releaseDate, "Not reached");
        
        release.isReleased = true;
        
        emit DataReleased(_dataId, core.owner, release.encryptedKey, block.timestamp);
        
        return release.encryptedKey;
    }
    
    function isDataReleased(bytes32 _dataId) external view returns (bool released, uint256 releaseDate) {
        CoreData memory core = coreData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        
        require(core.createdAt > 0, "Not found");
        
        if (release.releaseDate == 0) return (true, 0);
        
        return (release.isReleased || block.timestamp >= release.releaseDate, release.releaseDate);
    }
    
    function getDecryptionKey(bytes32 _dataId) external view returns (string memory) {
        CoreData memory core = coreData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        
        require(core.createdAt > 0, "Not found");
        
        if (release.releaseDate == 0 || release.isReleased || block.timestamp >= release.releaseDate) {
            return release.encryptedKey;
        }
        
        return "";
    }
    
    function manualRelease(bytes32 _dataId) external {
        CoreData storage core = coreData[_dataId];
        ReleaseData storage release = releaseInfo[_dataId];
        
        require(core.createdAt > 0, "Not found");
        require(core.owner == msg.sender, "Not owner");
        require(!release.isReleased, "Already released");
        require(release.releaseDate > 0, "No date set");
        
        release.isReleased = true;
        
        emit DataReleased(_dataId, core.owner, release.encryptedKey, block.timestamp);
    }
    
    function verifyDataIntegrity(bytes32 _dataId, bytes32 _dataHash) external view returns (bool) {
        return coreData[_dataId].currentDataHash == _dataHash;
    }
    
    function getDataIdByHash(bytes32 _dataHash, uint256 _version) external view returns (bytes32) {
        return hashToDataId[_dataHash][_version];
    }
    
    function getDataRecord(bytes32 _dataId) external view returns (DataRecord memory) {
        CoreData memory core = coreData[_dataId];
        MetaData memory meta = metaData[_dataId];
        ReleaseData memory release = releaseInfo[_dataId];
        
        require(core.createdAt > 0, "Not found");
        
        return DataRecord({
            owner: core.owner,
            currentDataHash: core.currentDataHash,
            currentStorageURI: core.currentStorageURI,
            currentProvider: core.currentProvider,
            createdAt: core.createdAt,
            lastUpdatedAt: core.lastUpdatedAt,
            fileSize: meta.fileSize,
            contentType: meta.contentType,
            fileName: meta.fileName,
            isPermanent: meta.isPermanent,
            currentVersion: meta.currentVersion,
            totalVersions: meta.totalVersions,
            totalFeePaid: meta.totalFeePaid,
            releaseDate: release.releaseDate,
            isReleased: release.isReleased,
            encryptedKey: release.encryptedKey
        });
    }
    
    function getDataVersion(bytes32 _dataId, uint256 _version) external view returns (DataVersion memory) {
        require(coreData[_dataId].createdAt > 0, "Not found");
        require(_version > 0 && _version <= metaData[_dataId].totalVersions, "Invalid version");
        
        return dataVersions[_dataId][_version];
    }
    
    function getDataInfo(bytes32 _dataId) external view returns (address owner, uint256 createdAt, bool isPermanent, uint256 currentVersion) {
        CoreData memory core = coreData[_dataId];
        MetaData memory meta = metaData[_dataId];
        
        require(core.createdAt > 0, "Not found");
        
        return (core.owner, core.createdAt, meta.isPermanent, meta.currentVersion);
    }
    
    function getUserDataIds(address _user, uint256 _offset, uint256 _limit) external view returns (bytes32[] memory dataIds, uint256 total) {
        require(_limit > 0 && _limit <= 100, "Limit 1-100");
        
        bytes32[] storage allIds = userDataIds[_user];
        total = allIds.length;
        
        if (_offset >= total) return (new bytes32[](0), total);
        
        uint256 end = _offset + _limit > total ? total : _offset + _limit;
        uint256 len = end - _offset;
        dataIds = new bytes32[](len);
        
        for (uint256 i = 0; i < len; i++) {
            dataIds[i] = allIds[_offset + i];
        }
        
        return (dataIds, total);
    }
    
    function getUserDataCount(address _user) external view returns (uint256) {
        return userDataIds[_user].length;
    }
    
    function deleteData(bytes32 _dataId) external nonReentrant {
        CoreData storage core = coreData[_dataId];
        MetaData storage meta = metaData[_dataId];
        
        require(core.createdAt > 0, "Not found");
        require(core.owner == msg.sender, "Not owner");
        require(!meta.isPermanent, "Cannot delete permanent");
        
        uint256 totalFeePaid = meta.totalFeePaid;
        uint256 refundAmount = (totalFeePaid * refundPercentage) / 10000;
        uint256 versionsDeleted = meta.totalVersions;
        
        for (uint256 i = 1; i <= versionsDeleted; i++) {
            DataVersion storage version = dataVersions[_dataId][i];
            delete hashToDataId[version.dataHash][i];
            delete dataVersions[_dataId][i];
        }
        
        _removeUserDataId(msg.sender, _dataId);
        
        delete coreData[_dataId];
        delete metaData[_dataId];
        delete releaseInfo[_dataId];
        totalRecordsStored--;
        
        if (refundAmount > 0) {
            pendingWithdrawals[msg.sender] += refundAmount;
            emit WithdrawalReady(msg.sender, refundAmount);
        }
        
        emit DataDeleted(_dataId, msg.sender, refundAmount, versionsDeleted);
    }
    
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No withdrawals");
        require(balanceOf(treasury) >= amount, "Insufficient treasury");
        
        pendingWithdrawals[msg.sender] = 0;
        _transfer(treasury, msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function _removeUserDataId(address _user, bytes32 _dataId) private {
        if (!userHasDataId[_user][_dataId]) return;
        
        uint256 index = userDataIdIndex[_user][_dataId];
        uint256 lastIndex = userDataIds[_user].length - 1;
        
        if (index != lastIndex) {
            bytes32 lastDataId = userDataIds[_user][lastIndex];
            userDataIds[_user][index] = lastDataId;
            userDataIdIndex[_user][lastDataId] = index;
        }
        
        userDataIds[_user].pop();
        delete userDataIdIndex[_user][_dataId];
        delete userHasDataId[_user][_dataId];
    }
    
    function setRegistrationFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= MAX_REGISTRATION_FEE, "Fee exceeds max");
        uint256 oldFee = registrationFee;
        registrationFee = _newFee;
        emit RegistrationFeeUpdated(oldFee, _newFee);
    }
    
    function setUpdateFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= MAX_UPDATE_FEE, "Fee exceeds max");
        uint256 oldFee = updateFee;
        updateFee = _newFee;
        emit UpdateFeeUpdated(oldFee, _newFee);
    }
    
    function setRefundPercentage(uint256 _newPercentage) external onlyOwner {
        require(_newPercentage <= MAX_REFUND_PERCENTAGE, "Exceeds 100%");
        uint256 oldPercentage = refundPercentage;
        refundPercentage = _newPercentage;
        emit RefundPercentageUpdated(oldPercentage, _newPercentage);
    }
    
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    function mint(address, uint256) external pure {
        revert("Minting disabled");
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}