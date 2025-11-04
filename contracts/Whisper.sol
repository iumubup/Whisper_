pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedChatHandler is ZamaEthereumConfig {
    
    struct ChatSession {
        address participantA;
        address participantB;
        euint32 encryptedMessage;
        uint256 timestamp;
        bool isActive;
    }
    
    struct MessageProof {
        bytes ciphertext;
        bytes proof;
    }
    
    mapping(bytes32 => ChatSession) public sessions;
    mapping(address => bytes32[]) public userSessions;
    
    event SessionCreated(bytes32 indexed sessionId, address indexed participantA, address indexed participantB);
    event MessageSent(bytes32 indexed sessionId, address indexed sender);
    event SessionEnded(bytes32 indexed sessionId);

    modifier onlyParticipant(bytes32 sessionId) {
        require(msg.sender == sessions[sessionId].participantA || 
                msg.sender == sessions[sessionId].participantB, "Not a participant");
        _;
    }

    constructor() ZamaEthereumConfig() {
    }

    function createSession(address participantB, externalEuint32 encryptedMessage, bytes calldata inputProof)
        external
        returns (bytes32 sessionId)
    {
        require(participantB != address(0), "Invalid participant");
        require(FHE.isInitialized(FHE.fromExternal(encryptedMessage, inputProof)), "Invalid encrypted input");

        sessionId = keccak256(abi.encodePacked(msg.sender, participantB, block.timestamp));
        require(sessions[sessionId].participantA == address(0), "Session already exists");

        sessions[sessionId] = ChatSession({
            participantA: msg.sender,
            participantB: participantB,
            encryptedMessage: FHE.fromExternal(encryptedMessage, inputProof),
            timestamp: block.timestamp,
            isActive: true
        });

        FHE.allowThis(sessions[sessionId].encryptedMessage);
        FHE.makePubliclyDecryptable(sessions[sessionId].encryptedMessage);

        userSessions[msg.sender].push(sessionId);
        userSessions[participantB].push(sessionId);

        emit SessionCreated(sessionId, msg.sender, participantB);
    }

    function sendMessage(bytes32 sessionId, externalEuint32 encryptedMessage, bytes calldata inputProof)
        external
        onlyParticipant(sessionId)
    {
        require(sessions[sessionId].isActive, "Session not active");
        require(FHE.isInitialized(FHE.fromExternal(encryptedMessage, inputProof)), "Invalid encrypted input");

        sessions[sessionId].encryptedMessage = FHE.fromExternal(encryptedMessage, inputProof);
        sessions[sessionId].timestamp = block.timestamp;

        FHE.allowThis(sessions[sessionId].encryptedMessage);
        FHE.makePubliclyDecryptable(sessions[sessionId].encryptedMessage);

        emit MessageSent(sessionId, msg.sender);
    }

    function endSession(bytes32 sessionId) external onlyParticipant(sessionId) {
        require(sessions[sessionId].isActive, "Session not active");
        sessions[sessionId].isActive = false;
        emit SessionEnded(sessionId);
    }

    function getSession(bytes32 sessionId)
        external
        view
        returns (address participantA, address participantB, uint256 timestamp, bool isActive)
    {
        ChatSession storage session = sessions[sessionId];
        require(session.participantA != address(0), "Session does not exist");
        return (session.participantA, session.participantB, session.timestamp, session.isActive);
    }

    function getUserSessions(address user) external view returns (bytes32[] memory) {
        return userSessions[user];
    }

    function getMessageProof(bytes32 sessionId) external view returns (MessageProof memory) {
        require(sessions[sessionId].isActive, "Session not active");
        return MessageProof({
            ciphertext: FHE.toBytes(sessions[sessionId].encryptedMessage),
            proof: FHE.getDecryptionProof(sessions[sessionId].encryptedValue)
        });
    }

    function verifyMessage(bytes32 sessionId, bytes memory plaintext, bytes memory proof) external {
        require(sessions[sessionId].isActive, "Session not active");
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(sessions[sessionId].encryptedValue);
        FHE.checkSignatures(cts, plaintext, proof);
    }
}

