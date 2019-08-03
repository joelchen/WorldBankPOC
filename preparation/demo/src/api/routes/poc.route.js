const express = require('express');
const sha256 = require('js-sha256');
const {creditScore, potSim, remoteAttestationSim, potSchema, betterResponse} = require('../../poc');


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
  .route('/newNodeJoin')
  .get(async (req, res) => {
    const {peerId, hacked} = req.query;
    const credit = await creditScore.get(peerId);
    if(credit){
      return betterResponse.responseBetterJson(res, {peerId, hacked}, {error:'Please change peerID, since this peerId has existed'});
    }
    const newCredit = await creditScore.set(peerId, '0');

    const potObj = potSim.createPlaceHolderPot({peerId, hacked: hacked == 'true'});

    const potHash = sha256(JSON.stringify(potObj));
    potObj.potHash = potHash;
    const newPotObj = await potSchema.newPot(potObj);
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
  .route('/setPeerScore/:id/:score')
  .get(async (req, res, next) => {
    try {
      const { id, score } = req.params;
      console.log('set id, score, ', id, score);
      const r = await creditScore.set(id, score);
      console.log('result is,', r);
      if (r) {
        return res.json(r);
      }
      return next();
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
  .get((req, res, next) => {
    const {peerId, potHash} = req.query;

    betterResponse.responseBetterJson(res, {peerId, potHash}, {});
   //return res.send();
    const newJoinTxHash = '1';
    // const privKey = 'placeholderPrivateKey';
    // const creditScore = 1000;//placeholder
    // remoteAttestationSim.notifyNewJoinNodeNeedRa({newJoinTxHash, peerId, privKey, creditScore});
    // const ret = sha256.hex(JSON.stringify({newJoinTxHash, peerId, privKey, creditScore}) );
    
  });
module.exports = router;
