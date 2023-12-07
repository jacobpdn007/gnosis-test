import Safe, { EthersAdapter } from "@safe-global/protocol-kit";
import {
    OperationType,
    SafeTransactionDataPartial,
    SafeTransaction,
} from "@safe-global/safe-core-sdk-types";
import { ethers } from "ethers";

interface Config {
    CHAIN_ID: number;
    RPC_URL: string;
    SAFE_ADDRESS: string;
    USDM_CONTRACT_ADDRESS: string;
    OWNER_PKS: string[];
    COLLECTOR_PK: string;
}

// Please set right config
const config: Config = {
    CHAIN_ID: 169,
    RPC_URL: "https://pacific-rpc.manta.network/http",
    SAFE_ADDRESS: "0x3C5D253E8eC05F7F75D74cDa0fB999C55007F40E",
    USDM_CONTRACT_ADDRESS: "0xf417F5A458eC102B90352F697D6e2Ac3A3d2851f",
    OWNER_PKS: ["", ""],
    COLLECTOR_PK: "",
};

// manta-pacific mainnet config, don't need change
const contractNetworks = {
    [config.CHAIN_ID]: {
        multiSendAddress: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
        safeMasterCopyAddress: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
        safeProxyFactoryAddress: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
        safeSingletonAddress: "",
        multiSendCallOnlyAddress: "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
        fallbackHandlerAddress: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
        signMessageLibAddress: "0xA65387F16B013cf2Af4605Ad8aA5ec25a2cbA3a2",
        createCallAddress: "0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4",
        simulateTxAccessorAddress: "0x59AD6735bCd8152B84860Cb256dD9e96b85F69Da",
    },
};

const USDM_CONTRACT_ABI = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "from",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "value",
                type: "uint256",
            },
        ],
        name: "Transfer",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "balanceOf",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "transfer",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const provider = new ethers.JsonRpcProvider(config.RPC_URL);

// just for tests
const TestReceiver = "0x82508c7cf44252f9a6d140684d8a725f03078f6e";
const TestUSDMAmount = 1000000n;

function generateTransferUSDMTx(to: string, amount: ethers.BigNumberish) {
    const USDM_CONTRACT = new ethers.Contract(
        config.USDM_CONTRACT_ADDRESS,
        USDM_CONTRACT_ABI
    );

    const data = USDM_CONTRACT.interface.encodeFunctionData("transfer", [
        to,
        amount,
    ]);

    const safeTransactionData: SafeTransactionDataPartial = {
        to: config.USDM_CONTRACT_ADDRESS,
        value: "0",
        data: data,
        operation: OperationType.Call,
    };

    return safeTransactionData;
}

async function getSignature(pk: string, safeTransaction: SafeTransaction) {
    const signer = new ethers.Wallet(pk, provider);
    const ethAdapter = new EthersAdapter({
        ethers: ethers,
        signerOrProvider: signer,
    });

    const safeSdk = await Safe.create({
        ethAdapter,
        safeAddress: config.SAFE_ADDRESS,
        contractNetworks: contractNetworks,
    });

    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    return await safeSdk.signTransactionHash(safeTxHash);
}

async function main() {
    const collector = new ethers.Wallet(config.COLLECTOR_PK, provider);

    // Create EthAdapter instance
    const ethAdapter = new EthersAdapter({
        ethers: ethers,
        signerOrProvider: collector,
    });

    const safeSdk = await Safe.create({
        ethAdapter,
        safeAddress: config.SAFE_ADDRESS,
        contractNetworks: contractNetworks,
    });

    const partialTx = generateTransferUSDMTx(TestReceiver, TestUSDMAmount);
    const safeTransaction = await safeSdk.createTransaction({
        transactions: [partialTx],
    });

    for (const pk of config.OWNER_PKS) {
        safeTransaction.addSignature(await getSignature(pk, safeTransaction));
    }

    const tx = await safeSdk.executeTransaction(safeTransaction);
    const receipt = await tx.transactionResponse?.wait();
    console.log(`transfer 1 usdm from multisig to receiver`);
    console.log(receipt);
}

main();
