# Whisper_Zama: FHE-based Anonymous Chat

Whisper_Zama is a privacy-preserving messaging application powered by Zama's Fully Homomorphic Encryption (FHE) technology. With the rise of digital communication, ensuring the privacy of personal messages and safeguarding against intrusive data analysis has never been more crucial. Whisper_Zama utilizes advanced encryption techniques to enable users to communicate freely without compromising their privacy. 

## The Problem

In today's digital landscape, the security of online communication is often compromised. Traditional messaging applications store messages in cleartext, making them vulnerable to data breaches, unauthorized access, and invasive data analysis. This not only endangers user privacy but also allows for the extraction of sensitive information from metadata, such as message origins and destinations. Users need a secure platform that ensures both message content and metadata remain confidential, facilitating true anonymity in communication.

## The Zama FHE Solution

Whisper_Zama addresses these critical privacy concerns by leveraging Fully Homomorphic Encryption, which allows for computation on encrypted data without requiring access to the plaintext. Using Zama's innovative libraries, such as fhevm, Whisper_Zama processes encrypted messages directly, ensuring that even when the messages are in transit, they remain unintelligible to any intermediary—including servers. 

By employing techniques like homomorphic forwarding logic, users can send and receive messages securely, while the encryption ensures that both the content and associated metadata are thoroughly protected from surveillance and unauthorized analysis.

## Key Features

- 🔒 **End-to-End Encryption**: All messages are encrypted from sender to receiver, ensuring complete confidentiality.
- ⚙️ **Homomorphic Processing**: Enables manipulation of encrypted data without decryption, preserving privacy throughout the communication.
- 🔍 **Metadata Protection**: Safeguards metadata from analysis, preventing tracking of user interactions.
- 🗨️ **User-Friendly Interface**: Intuitive design for seamless communication without compromising security.
- 🌐 **Decentralized Architecture**: Minimizes reliance on centralized servers, enhancing user autonomy and privacy.

## Technical Architecture & Stack

Whisper_Zama is built upon a robust technology stack that includes:

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Core Privacy Engine**: Zama FHE libraries (fhevm)
- **Database**: Secure encrypted storage solutions

This stack ensures that user interactions remain private and secure while providing a responsive and user-friendly experience.

## Smart Contract / Core Logic

Here’s a simplified pseudo-code example illustrating how Whisper_Zama processes encrypted messages using Zama's technology:

```solidity
// Contracts/Whisper_Zama.sol
pragma solidity ^0.8.0;

import "fhevm";

contract Whisper_Zama {
    function sendMessage(uint64 encryptedMessage) public {
        uint64 result = TFHE.add(encryptedMessage, 1); // Example of homomorphic operation
        storeMessage(result);
    }

    function receiveMessage(uint64 encryptedMessage) public view returns (string memory) {
        return TFHE.decrypt(encryptedMessage); // Decrypt the message for the receiver
    }
}
```

This snippet demonstrates the core logic of sending and receiving messages, highlighting the use of homomorphic operations and decryption.

## Directory Structure

The structure of the Whisper_Zama project is as follows:

```
Whisper_Zama/
├── src/
│   ├── index.html
│   ├── app.js
├── contracts/
│   └── Whisper_Zama.sol
├── scripts/
│   └── main.py
├── README.md
└── package.json
```

## Installation & Setup

### Prerequisites

Before you begin, ensure you have [Node.js](https://nodejs.org/) installed, along with npm for package management.

### Install Dependencies

To set up the project, navigate to the project directory and run the following commands:

1. Install necessary packages:

```bash
npm install
```

2. Install Zama’s FHE library:

```bash
npm install fhevm
```

3. For the Python scripts, install the required libraries:

```bash
pip install concrete-ml
```

## Build & Run

To compile and run the application, use the following commands:

1. For compiling the smart contract:

```bash
npx hardhat compile
```

2. To start the application:

```bash
node app.js
```

3. To run the Python scripts for any additional functionalities:

```bash
python main.py
```

## Acknowledgements

We would like to express our gratitude to Zama for providing the open-source Fully Homomorphic Encryption primitives that make Whisper_Zama possible. Their innovative libraries empower developers to create secure and privacy-centric applications that meet the needs of users in an increasingly surveillance-oriented world.

---

Whisper_Zama is your go-to solution for anonymous communication, ensuring that your conversations remain private and secure. Join us in the mission to reclaim digital privacy, and experience free communication without boundaries—powered by Zama's FHE technology.

