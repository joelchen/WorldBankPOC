import service from '../../service';
;
const express = require('express');
const sha256 = require('js-sha256');
const {creditScore, potSim, remoteAttestationSim, potSchema, betterResponse, gasSim, result, constValue, txLogSchema} = require('../../poc');

const _ = require('lodash');

const router = express.Router();
console.log("credit", creditScore);
router
  .route('/')
  .get((req, res) => {
    res.send('You are doing great');
  });

router
  .route('/status')
  .get((req, res) => {
    res.send('You will see updates here');
  });

router
  .route('/newBlockPub/:blockId')
  .get(async (req, res)=>{
    const {blockId} = req.params;
    const pubsubRooms = req.app.get('pubsubRooms');
    const ipfs = req.app.get('ipfs');
    const townHall = pubsubRooms.townHall;
    const tx0 = {
      hash:"asdfasdfasdf",
      content:"Hey, I am Satoshi."
    }
    const block0 = {
      height:0,
      txs:[(await ipfs.dag.put(tx0))]
    };
    const block0Cid = await ipfs.dag.put(block0);
    if(blockId == 0){
      
      const result = await pubsubRooms.townHall.broadcast(block0Cid.toBaseEncodedString());
      console.log("broadcast result:", result);
      return res.send(JSON.stringify("<html><head></head><body>Block " + blockId + " is sent. Its CID is " + block0Cid.toBaseEncodedString() + "</body></html"));
    }
    const tx1 = {
      hash:"fjalsahd",
      content:"I am James Bond. I am following Satoshi!"
    }
    const tx2 = {
      hash: "fjslsaaisdhf",
      content: "Send me 1000 BTC, or I will kill you"
    }
    const block1 = {
      height: 1,
      previousBlockCid: block0Cid,
      txs:[(
        await ipfs.dag.put(tx1)
      ),
      (
        await ipfs.dag.put(tx2)
      )]
    };
    const block1Cid = await ipfs.dag.put(block1);
    
    if(blockId == 1){
      const result = await pubsubRooms.townHall.broadcast(block1Cid.toBaseEncodedString());
      console.log("broadcast result:", result);
      return res.send(JSON.stringify("<html><head></head><body>Block " + blockId + " is sent. Its CID:" + block1Cid.toBaseEncodedString() + "</body></html"));
    }
    const tx3 = {
      hash:"fjalsdkashgldf",
      content:"Bang, Satoshi died, game over"
    }
    const block2 = {
      height: 2,
      previousBlockCid: block1Cid,
      txs:[(
        await ipfs.dag.put(tx3))
      ]
    };
    const block2Cid = await ipfs.dag.put(block2);
    
    if(blockId == 2){
      const result = await pubsubRooms.townHall.broadcast(block2Cid.toBaseEncodedString());
      console.log("broadcast result:", result);
      return res.send(JSON.stringify("<html><head></head><body>Block " + blockId + " is sent. Its CID:" + block2Cid.toBaseEncodedString() + "</body></html"));
    }
  });
router
  .route('/faucetGasToPeer')
  .get(async (req,res) => {
    const {peerId, amt, json} = req.query;
    const amtNumber = Number.parseInt(amt);
    const gasTransactionId = await gasSim.transferGasFromEscrow(peerId, amtNumber, "FaucetGasTransfer_ref_peerId", peerId);
    if(json){
      return result(res, 1, gasTransactionId);
    }
    betterResponse.responseBetterJson(res, {peerId, amtNumber}, {gasTransactionId});
  });
router
  .route('/newJoinNodeDeposit')
  .get(async (req, res) => {
    const {peerId, depositGasAmt, json} = req.query;
    const credit = await creditScore.get(peerId);
    console.log('credit obj,', credit);
    if(credit && credit.creditScore && credit.creditScore > 0){
      if(json){
        return result(res, -1, 'Please change peerID, since this peerId has existed');
      }
      return betterResponse.responseBetterJson(res, {peerId, depositGasAmt}, {error:'Please change peerID, since this peerId has existed'});
    }

    const depositGasAmtNumber = Number.parseInt(depositGasAmt || 0);
    if(! depositGasAmt || depositGasAmtNumber < 10){
      if(json){
        return result(res, -1, 'Deposit gas for intial remote attestion need to be more than 10');
      }
      return betterResponse.responseBetterJson(res, {peerId, depositGasAmt}, {error:'Deposit gas for intial remote attestion need to be more than 10'});
    }
    
    // if (depositGasAmtNumber < 10){
    //   return betterResponse.responseBetterJson(res, {peerId, depositGasAmt}, {error:'Deposit gas for intial remote attestion need to be more than 10'});
    // }

    console.log('depositGasAmtNumber', depositGasAmtNumber)
    const gasTransactionId = await gasSim.transferGasToEscrow(peerId, depositGasAmtNumber, "NewNodeJoinDepositGas_ref_peerId", peerId);

    if(json){
      return result(res, 1, {peerId, depositGasAmt, gasTransactionId});
    }
    betterResponse.responseBetterJson(res, {peerId, depositGasAmt}, {gasTransactionId});
  });

router
  .route('/newNodeJoin')
  .get(async (req, res) => {
    const {peerId, hacked, depositGasTxId, json, lat, lng} = req.query;
    const credit = await creditScore.get(peerId);
    if(credit && credit.creditScore && credit.creditScore > 0){
      if(json){
        return result(res, -1, 'Please change peerID, since this peerId has existed');
      }
      return betterResponse.responseBetterJson(res, {peerId, hacked, depositGasTxId}, {error:'Please change peerID, since this peerId has existed'});
    }
    if(! depositGasTxId){
      if(json){
        return result(res, -1, 'In order to join the trusted network, you have to pay a init gas fee for other trusted nodes to give you an approval based on PoT value. This is called Remote Attestation. Please attach the txId of your deposit to Escrow account');
      }
      return betterResponse.responseBetterJson(res, {peerId, hacked, depositGasTxId}, {error:'In order to join the trusted network, you have to pay a init gas fee for other trusted nodes to give you an approval based on PoT value. This is called Remote Attestation. Please attach the txId of your deposit to Escrow account'});
    
    }
    const depositGasTxIdValidation = (no_use, {fromPeerId, toPeerId, amt, tokenType, referenceEventType, referenceEventId})=>{
      if(fromPeerId != constValue.gasFaucetPeerId){
        if(fromPeerId != peerId) return false;
      }
      if(amt < 10)  return false;
      
      if(tokenType != 'gas') return false;
      if(referenceEventType != 'NewNodeJoinDepositGas_ref_peerId') return false;
      if((referenceEventId != constValue.gasFaucetPeerId) && (referenceEventId != peerId)) return false;
      return true;
    }; 
    if(! await txLogSchema.doValidationOnGasTx(depositGasTxId, '', depositGasTxIdValidation)){
      return betterResponse.responseBetterJson(res, {peerId, hacked, depositGasTxId}, {error:'We cannot find the Proof of Payment from the TxId You attached. In order to join the trusted network, you have to pay a init gas fee for other trusted nodes to give you an approval based on PoT value. This is called Remote Attestation. Please attach the txId of your deposit to Escrow account'});
    
    }
    
    const newCredit = await creditScore.set(peerId, '0');

    const potObj = potSim.createPlaceHolderPot({peerId, hacked: hacked == 'true', depositGasTxId});

    const potHash = sha256(JSON.stringify(potObj));
    potObj.potHash = potHash;
    potObj.location = [lat || 0, lng || 0];
    const newPotObj = await potSchema.newPot(potObj);
    if(json){
      return result(res, 1, newPotObj);
    }
    betterResponse.responseBetterJson(res, {peerId, hacked}, {newPotObj});
  });

router
  .route('/checkCredit/:id')

  .get(async (req, res, next) => {
    try {
      const { id } = req.params;
      const credit = await creditScore.get(id);
      if (credit) {
        return res.json(credit);
      }
      return next();
    } catch (error) {
      return res.json(error.message);
    }
  });

router
  .route('/setPeerScore')
  .get(async (req, res) => {
    try {
      const { peerId, score, json } = req.query;
      const r = await creditScore.set(peerId, score);
      if(json){
        return result(res, 1, r);
      }
      return betterResponse.responseBetterJson(res, req.query, {r});
    } catch (error) {
      console.log('error line13', error);
      return res.json(error.message);
    }
  });

  // router
  // .route('/potVerify')
  // .post((req, res, next) => {
  //   const {wannaPass} = req.query;
  //   const {pot} = req.body;
    
  //   if(potObj){
  //     return res.json(potObj);
  //   }else{
  //     return next();
  //   }
  // })
  // .get((req, res) => {
  //   const {badPot, wannaPass} = req.query;
  //   const testPot = badPot? potSim.sampleBadPot() : potSim.sampleGoodPot();
  //   const bForcePass = wannaPass? true: false;
  //   return res.send( potSim.verifyPot(testPot, bForcePass));
  // });

router
  .route('/tryRa')
  .get(async (req, res, next) => {
    const {peerId, potHash, json} = req.query;
    const rs = await remoteAttestationSim.tryRa({peerId, potHash});
    console.log('tryRa => ', rs);
    if(json){
      if(rs.result && rs.result !== 'error'){
        return result(res, 1, rs);
      }else{
        return result(res, -1, rs.message)
      }
      
    }
    betterResponse.responseBetterJson(res, {peerId, potHash}, rs);
  });

router
  .route('/potList')
  .get(async (req, res)=>{
    let list = await potSchema.getAll();
    const ids = _.map(list, (item)=>{
      return item.peerId;
    });
    const cs = await creditScore.find({
      peerId : {
        $in : ids
      }
    }).exec();
    const gs = await gasSim.find({
      peerId : {
        $in : ids
      }
    }).exec();
    list = _.map(list, (item)=>{
      const tmp = _.find(cs, (x)=>x.peerId===item.peerId);
      const tmp1 = _.find(gs, (x)=>x.peerId===item.peerId);

      const rs = item.toJSON();
      rs.creditScore = tmp.creditScore;
      rs.gas = tmp1.gasBalance
      return rs;
    });
    return result(res, 1, list);
  });

router
  .route('/deletePot')
  .get(async (req, res)=>{
    const {peerId} = req.query;
    
    try{
      await gasSim.remove({peerId});
      await creditScore.remove({peerId});
      await potSchema.remove({peerId});

      return result(res, 1, 'ok');
    }catch(e){
      return result(res, -1, e.toString());
    }
    

    
  });

router
  .route('/txLogs/:peerId')
  .get(async (req, res)=>{
    const { peerId } = req.params;
    const list = await txLogSchema.getAllByPeerId(peerId);

    return result(res, 1, list);
  });

router
  .route('/createGenesisPot')
  .get(async (req, res)=>{
    try{
      await potSim.createGenesisPot();
      return result(res, 1, 'ok');
    }catch(e){
      return result(res, -1, e.toString());
    }
      
  });

router 
  .route('/joinTask')
  .get(async (req, res)=>{
    const {peerId, taskId} = req.query;

    const taskService = service.getTaskService();
    try{
      const rs = await taskService.joinToElectHandleTask(peerId, taskId);
      return result(res, 1, rs);
    }catch(e){
      return result(res, -1, e.toString());
    }
  });
router
  .route('/crateNewTask')
  .get(async (req, res)=>{
    const {peerId, amt, type} = req.query;

    const taskService = service.getTaskService();
    try{
      let rs = '';
      if(type === 'ra'){
        return result(res, -1, 'ra task will coming soon');
      }
      else{
        rs = await taskService.createNewCalculateTask(peerId, _.toNumber(amt));
      }
      return result(res, 1, rs);
    }catch(e){
      return result(res, -1, e.toString());
    }
  });

router
  .route('/taskList')
  .get(async (req, res)=>{
    const taskService = service.getTaskService();
    const {peerId} = req.query;
    try{
      const can_join_list = await taskService.getAllTask({
        status : 'elect',
        $nor : [
          {
            joiner: peerId
          }
        ]
      });
      const join_list = await taskService.getAllTask({
        joiner : peerId
      });
      const own_list = await taskService.getAllTask({peerId});
      return result(res, 1, {
        can_join_list, join_list, own_list
      });
    }catch(e){
      return result(res, -1, e.toString());
    }
  });

router
  .route('/taskLog')
  .get(async (req, res)=>{
    const taskService = service.getTaskService();
    const {taskId} = req.query;
    try{
      
      const list = await taskService.getAllTaskLog({taskId});
      return result(res, 1, list);
    }catch(e){
      return result(res, -1, e.toString());
    }
  })



module.exports = router;
