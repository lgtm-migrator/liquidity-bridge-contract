// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

interface Bridge {
    function registerBtcTransfer(
        bytes calldata btcTxSerialized, 
        uint256 height, 
        bytes calldata pmtSerialized, 
        bytes32 derivationArgumentsHash, 
        bytes calldata userRefundBtcAddress, 
        address liquidityBridgeContractAddress,
        bytes calldata liquidityProviderBtcAddress, 
        uint amountToTransfer
    ) external returns (int256 executionStatus);
}
