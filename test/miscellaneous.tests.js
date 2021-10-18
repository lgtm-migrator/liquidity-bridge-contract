const LiquidityBridgeContract = artifacts.require('LiquidityBridgeContract');
const BridgeMock = artifacts.require("BridgeMock");
const Mock = artifacts.require('Mock')
const truffleAssert = require('truffle-assertions');

contract('LiquidityBridgeContract', async accounts => {
    let instance;
    let bridgeMockInstance;
    
    before(async () => {
        instance = await LiquidityBridgeContract.deployed();
        bridgeMockInstance = await BridgeMock.deployed();
        mock = await Mock.deployed()
    });

    it ('should register liquidity provider', async () => {
        let val = 100;
        let currAddr = accounts[0];
        let existing = await instance.getCollateral(currAddr); 

        await instance.register({value : val});

        let current = await instance.getCollateral(currAddr);
        let registered = current.toNumber() - existing.toNumber();

        assert.equal(val, registered);
    });

    it ('should not allow attacker to steal funds', async () => {
        // The attacker controls a liquidity provider and also a destination address
        // Note that these could be the same address, separated for clarity
        let attackingLP = accounts[7];
        let attackerCollateral = web3.utils.toWei("10");
        await instance.register.call({
                value: attackerCollateral, 
                from: attackingLP
            });


        let goodLP = accounts[8];
        let goodProviderCollateral = web3.utils.toWei("30");
        await instance.register.call({
            value: goodProviderCollateral, 
            from: goodLP
        });

        let attackerDestAddress = accounts[9];
        // Let's record how much money is there in the LBC and how much
        // is in control of the attacker
        let initialAttackerBalance = await web3.eth.getBalance(attackerDestAddress);
        let initialLBCBalance = await web3.eth.getBalance(instance.address);

        // Add funds from an innocent liquidity provider, note again this could be
        // done by an attacker
        // The quote value in wei should be bigger than 2**63-1. 10 RBTC is a good approximation.
        let quoteValue = web3.utils.numberToHex(web3.utils.toWei("10"));
        // Let's create the evil quote.
        let btcRawTransaction = '0x101';
        let partialMerkleTree = '0x202';
        let height = 10;
        let userBtcRefundAddress = '0x000000000000000000000000000000000000000000';
        let liquidityProviderBtcAddress = '0x000000000000000000000000000000000000000000';
        let rskRefundAddress = attackerDestAddress;
        let fedBtcAddress = '0x0000000000000000000000000000000000000000';
        let liquidityProviderRskAddress = attackingLP;
        let data = '0x00';
        let callFee = web3.utils.toBN(1);        
        let gasLimit = 30000;
        let nonce = 1;
        let lbcAddress = instance.address;
        let agreementTime = Math.round(Date.now() / 1000);
        let timeForDeposit = 600;
        let callTime = 600;
        let depositConfirmations = 10;
        let penaltyFee = web3.utils.toBN(0);
        let callOnRegister = true;
        let quote = [
            fedBtcAddress,
            lbcAddress,
            liquidityProviderRskAddress,
            userBtcRefundAddress,
            rskRefundAddress,
            liquidityProviderBtcAddress,
            callFee,
            penaltyFee,
            attackerDestAddress,
            data,
            gasLimit,
            nonce,
            quoteValue,
            agreementTime,
            timeForDeposit,
            callTime,
            depositConfirmations,
            callOnRegister
        ];
        // Let's now register our quote in the bridge... note that the
        // value is only a hundred wei
        let transferredInBTC = 100;
        let quoteHash = await instance.hashQuote(quote);
        let signature = await web3.eth.sign(quoteHash, liquidityProviderRskAddress);
        let firstConfirmationTime = web3.utils.toHex(agreementTime + 300).slice(2, 12);
        let nConfirmationTime = web3.utils.toHex(agreementTime + 600).slice(2, 12);
        let firstHeader = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' + firstConfirmationTime + '0000000000000000';
        
        let nHeader = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' + nConfirmationTime + '0000000000000000';
        await bridgeMockInstance.setHeader(height, firstHeader);
        await bridgeMockInstance.setHeader(height + depositConfirmations - 1, nHeader);
        await bridgeMockInstance.setPegin(quoteHash, {value : transferredInBTC});
        // Register the peg in with the evil quote
        amount = await instance.registerPegIn(
            quote,
            signature,
            btcRawTransaction,
            partialMerkleTree,
            height
        );
        // The user will _not_ get their money back, as their deposit
        // of only 100 wei was not enough to cover the quoteValue of more 20 wei
        // They don't even get their 100 back, as it is not enough to surpass dust.
        let finalAttackerBalance = await web3.eth.getBalance(attackerDestAddress);
        let lbcFinalBalance = await web3.eth.getBalance(lbcAddress);

        assert.equal(initialAttackerBalance, finalAttackerBalance);
        assert.notEqual(lbcFinalBalance, 0)                
    });

    it ('should pay with insufficient deposit', async () => {
        let val = web3.utils.toBN(10);
        let btcRawTransaction = '0x101';
        let partialMerkleTree = '0x202';
        let height = 10;
        let userBtcRefundAddress = '0x000000000000000000000000000000000000000000';
        let liquidityProviderBtcAddress = '0x000000000000000000000000000000000000000000';
        let rskRefundAddress = accounts[2];
        let destAddr = accounts[1];
        let initialUserBalance = await web3.eth.getBalance(destAddr);
        let fedBtcAddress = '0x0000000000000000000000000000000000000000';
        let liquidityProviderRskAddress = accounts[0];
        let initialLPBalance = await instance.getBalance(liquidityProviderRskAddress);
        let initialLBCBalance = await web3.eth.getBalance(instance.address);
        let data = '0x00';
        let callFee = 1;
        let gasLimit = 150000;
        let nonce = 0;
        let additionalFunds = -1;
        let peginAmount = web3.utils.toBN(val).add(web3.utils.toBN(callFee)).add(web3.utils.toBN(additionalFunds));
        let lbcAddress = instance.address;
        let agreementTime = Math.round(Date.now() / 1000);
        let timeForDeposit = 600;
        let callTime = 600;
        let depositConfirmations = 10;
        let penaltyFee = 0;
        let callOnRegister = false;
        let quote = [
            fedBtcAddress, 
            lbcAddress, 
            liquidityProviderRskAddress, 
            userBtcRefundAddress, 
            rskRefundAddress, 
            liquidityProviderBtcAddress, 
            callFee, 
            penaltyFee,
            destAddr, 
            data, 
            gasLimit, 
            nonce, 
            val, 
            agreementTime, 
            timeForDeposit, 
            callTime, 
            depositConfirmations,
            callOnRegister
        ];
        let quoteHash = await instance.hashQuote(quote);
        let signature = await web3.eth.sign(quoteHash, liquidityProviderRskAddress);
        let firstConfirmationTime = web3.utils.toHex(agreementTime + 300).slice(2, 12);
        let nConfirmationTime = web3.utils.toHex(agreementTime + 600).slice(2, 12);
        let firstHeader = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' + firstConfirmationTime + '0000000000000000';
        let nHeader = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' + nConfirmationTime + '0000000000000000';

        await bridgeMockInstance.setPegin(quoteHash, {value : peginAmount});
        await bridgeMockInstance.setHeader(height, firstHeader);
        await bridgeMockInstance.setHeader(height + depositConfirmations - 1, nHeader);

        initialLPDeposit = await instance.getCollateral(liquidityProviderRskAddress);

        await instance.callForUser(
            quote,
            {value : val}
        );

        currentLPBalance = await instance.getBalance(liquidityProviderRskAddress);

        assert.equal(currentLPBalance.toNumber(), initialLPBalance.toNumber());

        amount = await instance.registerPegIn.call(
            quote,
            signature,
            btcRawTransaction,
            partialMerkleTree,
            height
        );

        await instance.registerPegIn(
            quote,
            signature,
            btcRawTransaction,
            partialMerkleTree,
            height
        );

        finalLPBalance = await instance.getBalance(liquidityProviderRskAddress);
        finalLBCBalance = await web3.eth.getBalance(instance.address);
        finalUserBalance = await web3.eth.getBalance(destAddr);
        finalLPDeposit = await instance.getCollateral(liquidityProviderRskAddress);

        let usrBal = web3.utils.toBN(finalUserBalance).sub(web3.utils.toBN(initialUserBalance));
        let lbcBal = web3.utils.toBN(finalLBCBalance).sub(web3.utils.toBN(initialLBCBalance));
        let lpBal = web3.utils.toBN(finalLPBalance).sub(web3.utils.toBN(initialLPBalance));
        expect(peginAmount.toNumber()).to.eql(amount.toNumber());
        expect(usrBal.toNumber()).to.eq(val.toNumber());
        expect(lbcBal.toNumber()).to.eql(peginAmount.toNumber());
        expect(lpBal.toNumber()).to.eql(peginAmount.toNumber());
        expect(finalLPDeposit).to.eql(initialLPDeposit);
    });
});
