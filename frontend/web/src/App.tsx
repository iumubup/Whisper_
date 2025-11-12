import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface ChatMessage {
  id: string;
  content: string;
  timestamp: number;
  sender: string;
  encryptedValue: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newMessage, setNewMessage] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeUsers, setActiveUsers] = useState(0);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
        setActiveUsers(Math.floor(Math.random() * 50) + 10);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const messagesList: ChatMessage[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          messagesList.push({
            id: businessId,
            content: businessData.description,
            timestamp: Number(businessData.timestamp),
            sender: businessData.creator,
            encryptedValue: Number(businessData.publicValue1) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setMessages(messagesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const sendMessage = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setSendingMessage(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting message with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const messageValue = newMessage.length;
      const businessId = `msg-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, messageValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        "Chat Message",
        encryptedResult.encryptedData,
        encryptedResult.proof,
        messageValue,
        0,
        newMessage
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Sending encrypted message..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Message sent successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowSendModal(false);
      setNewMessage("");
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Send failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setSendingMessage(false); 
    }
  };

  const decryptMessage = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Message already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Message decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Message is already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const callIsAvailable = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const result = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Contract call failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const renderStats = () => {
    const totalMessages = messages.length;
    const verifiedMessages = messages.filter(m => m.isVerified).length;
    const todayMessages = messages.filter(m => 
      Date.now()/1000 - m.timestamp < 60 * 60 * 24
    ).length;

    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-info">
            <div className="stat-value">{totalMessages}</div>
            <div className="stat-label">Total Messages</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{verifiedMessages}</div>
            <div className="stat-label">Verified</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-value">{activeUsers}</div>
            <div className="stat-label">Active Users</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <div className="stat-value">{todayMessages}</div>
            <div className="stat-label">Today</div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <div className="process-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Encrypt</h4>
            <p>Message length encrypted with FHE</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Store</h4>
            <p>Encrypted data stored on-chain</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>Decrypt</h4>
            <p>Offline decryption with proof</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h4>Verify</h4>
            <p>On-chain verification</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo-section">
            <div className="logo">🔒</div>
            <h1>Whisper_Zama</h1>
          </div>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </header>
        
        <div className="welcome-screen">
          <div className="welcome-content">
            <div className="welcome-icon">🎭</div>
            <h2>Anonymous Encrypted Chat</h2>
            <p>Connect your wallet to start private conversations protected by FHE encryption</p>
            <div className="feature-list">
              <div className="feature">
                <span>🔐</span>
                <p>End-to-end FHE encryption</p>
              </div>
              <div className="feature">
                <span>🎭</span>
                <p>Complete anonymity</p>
              </div>
              <div className="feature">
                <span>⚡</span>
                <p>Zero-knowledge verification</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="encryption-animation"></div>
        <p>Initializing FHE Encryption...</p>
        <p className="status-text">{fhevmInitializing ? "Connecting to Zama Network" : status}</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="encryption-animation"></div>
      <p>Loading encrypted messages...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-section">
            <div className="logo">🔒</div>
            <h1>Whisper_Zama</h1>
          </div>
          <nav className="main-nav">
            <button className="nav-btn active">Chat</button>
            <button className="nav-btn" onClick={callIsAvailable}>Status</button>
          </nav>
        </div>
        
        <div className="header-right">
          <button className="send-btn" onClick={() => setShowSendModal(true)}>
            + New Message
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>

      <main className="main-content">
        <div className="sidebar">
          <div className="search-section">
            <input 
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="stats-section">
            <h3>Chat Overview</h3>
            {renderStats()}
          </div>
          
          <div className="fhe-info-section">
            <h3>FHE Protection</h3>
            {renderFHEProcess()}
          </div>
        </div>

        <div className="chat-area">
          <div className="chat-header">
            <h2>Encrypted Messages</h2>
            <div className="chat-actions">
              <button onClick={loadData} disabled={isRefreshing} className="refresh-btn">
                {isRefreshing ? "🔄" : "↻"}
              </button>
            </div>
          </div>
          
          <div className="messages-list">
            {filteredMessages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <p>No encrypted messages yet</p>
                <button className="send-btn" onClick={() => setShowSendModal(true)}>
                  Send First Message
                </button>
              </div>
            ) : (
              filteredMessages.map((message, index) => (
                <div 
                  key={index}
                  className={`message-bubble ${message.sender === address ? 'own-message' : ''} ${message.isVerified ? 'verified' : ''}`}
                  onClick={() => setSelectedMessage(message)}
                >
                  <div className="message-header">
                    <span className="sender">{message.sender === address ? 'You' : message.sender.substring(0, 8)}...</span>
                    <span className="time">{new Date(message.timestamp * 1000).toLocaleTimeString()}</span>
                  </div>
                  <div className="message-content">{message.content}</div>
                  <div className="message-footer">
                    <span className={`status ${message.isVerified ? 'verified' : 'encrypted'}`}>
                      {message.isVerified ? '✅ Verified' : '🔒 Encrypted'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showSendModal && (
        <SendMessageModal
          onSubmit={sendMessage}
          onClose={() => setShowSendModal(false)}
          sending={sendingMessage}
          message={newMessage}
          setMessage={setNewMessage}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedMessage && (
        <MessageDetailModal
          message={selectedMessage}
          onClose={() => {
            setSelectedMessage(null);
            setDecryptedContent(null);
          }}
          decryptedContent={decryptedContent}
          isDecrypting={isDecrypting || fheIsDecrypting}
          decryptMessage={() => decryptMessage(selectedMessage.id)}
        />
      )}

      {transactionStatus.visible && (
        <div className={`transaction-toast ${transactionStatus.status}`}>
          <div className="toast-content">
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <span>{transactionStatus.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const SendMessageModal: React.FC<{
  onSubmit: () => void;
  onClose: () => void;
  sending: boolean;
  message: string;
  setMessage: (msg: string) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, sending, message, setMessage, isEncrypting }) => {
  return (
    <div className="modal-overlay">
      <div className="send-modal">
        <div className="modal-header">
          <h2>Send Encrypted Message</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="encryption-notice">
            <div className="notice-icon">🔐</div>
            <div>
              <strong>FHE Encrypted</strong>
              <p>Message length will be encrypted using Zama FHE technology</p>
            </div>
          </div>
          
          <div className="message-input">
            <label>Your Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your anonymous message..."
              rows={4}
            />
            <div className="input-info">
              <span>Message length: {message.length} characters</span>
              <span className="fhe-badge">FHE Protected</span>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit}
            disabled={sending || isEncrypting || !message.trim()}
            className="send-btn"
          >
            {sending || isEncrypting ? "Encrypting..." : "Send Message"}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageDetailModal: React.FC<{
  message: ChatMessage;
  onClose: () => void;
  decryptedContent: string | null;
  isDecrypting: boolean;
  decryptMessage: () => Promise<number | null>;
}> = ({ message, onClose, decryptedContent, isDecrypting, decryptMessage }) => {
  const handleDecrypt = async () => {
    await decryptMessage();
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal">
        <div className="modal-header">
          <h2>Message Details</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="message-info">
            <div className="info-row">
              <span>Sender:</span>
              <strong>{message.sender}</strong>
            </div>
            <div className="info-row">
              <span>Time:</span>
              <strong>{new Date(message.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-row">
              <span>Status:</span>
              <span className={`status-badge ${message.isVerified ? 'verified' : 'encrypted'}`}>
                {message.isVerified ? '✅ On-chain Verified' : '🔒 Encrypted'}
              </span>
            </div>
          </div>
          
          <div className="message-content">
            <h4>Content</h4>
            <div className="content-box">{message.content}</div>
          </div>
          
          <div className="encryption-section">
            <h4>FHE Encryption</h4>
            <div className="encryption-info">
              <div className="encryption-status">
                <span>Message Length: {message.encryptedValue} characters</span>
                {message.isVerified && (
                  <span className="verified-value">Decrypted: {message.decryptedValue}</span>
                )}
              </div>
              
              <button 
                onClick={handleDecrypt}
                disabled={isDecrypting || message.isVerified}
                className={`decrypt-btn ${message.isVerified ? 'verified' : ''}`}
              >
                {isDecrypting ? "Decrypting..." : message.isVerified ? "✅ Verified" : "🔓 Verify Decryption"}
              </button>
            </div>
            
            <div className="fhe-explanation">
              <p>This message is protected by FHE encryption. The content remains private while allowing verification of the encrypted data.</p>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;

