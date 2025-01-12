import {tryParseJson, logToWebPage, updateLog} from './utils'
import { ExceptionHandler, exceptions } from 'winston';
const {utils, ecvrf, sortition} = require('vrf.js');
import {sha256} from 'js-sha256';
import {expectNumberOfRemoteAttestatorsToBeVoted, minimalNewNodeJoinRaDeposit, expectNumberOfExecutorGroupToBeVoted} from '../constValue';
const Big = require('big.js');
import {eligibilityCheck, executeCompute, chooseExecutorAndMonitors} from '../computeTask';
import {validatePot} from '../remoteAttestation';


const processNewBlock = async (options)=>{
  const ipfs = options.ipfs;

  //options.isProcessingBlock = true;
  const {block} = options;
  if (verifyBlockIntegrity()){
    //options.block.processedTxs
  }
  let totalGas = 0;
  for(const g in block.gasMap){
    totalGas += block.gasMap[g];
  }
  
  let totalCredit = 0;
  for(const c in block.creditMap){
    totalCredit += block.creditMap[c];
  }
  
  let totalCreditForOnlineNodes = block.totalCreditForOnlineNodes;

  updateNodeStatusOnNewBlock(options, totalGas, totalCredit, totalCreditForOnlineNodes);
  
  handleProcessedTxs(options, totalGas, totalCredit, totalCreditForOnlineNodes);

  handlePendingTasks(options, totalGas, totalCredit, totalCreditForOnlineNodes);

  return options;
  
}

const handleProcessedTxs = (options, totalGas, totalCredit, totalCreditForOnlineNodes)=>{
  const {userInfo, block} = options;
  const newNodeJoinNeedRaTxsCid = [];
  const remoteAttestationDoneTxsCid = [];
  const uploadLambdaTxsCid = [];
  const computeTaskTxsCid = [];
  const computeTaskWinnerApplicationCid = [];
  block.processedTxs.forEach((tx)=>{
    if(tx.txType == 'newNodeJoinNeedRa')  newNodeJoinNeedRaTxsCid.push(tx.cid);
    if(tx.txType == 'remoteAttestationDone')  remoteAttestationDoneTxsCid.push(tx.cid);
    if(tx.txType == 'uploadLambda')  uploadLambdaTxsCid.push(tx.cid);
    if(tx.txType == 'computeTask')  computeTaskTxsCid.push(tx.cid);
    if(tx.txType == 'computeTaskWinnerApplication') computeTaskWinnerApplicationCid.push(tx.cid);
  });
  
  const userCreditBalance = block.creditMap[userInfo.userName];
  
  newNodeJoinNeedRaTxsCid.map((cid)=>{
    options.ipfs.dag.get(cid).then(tx=>{
      if(tx.value.ipfsPeerId == userInfo.ipfsPeerId){
        console.log("I am the node myself, I cannot do remote attestation on myself, skip");
        return;
      }
      if(tx.value.depositAmt < minimalNewNodeJoinRaDeposit){
        console.log(`The new node did not pay enough gas to do the RA, he has paid ${tx.value.depositAmt}. Remote attestation abort now`);
        logToWebPage("Found the new node doesn't have enough gas to pay for the remote attestaiton process. I will not continue to process. just drop it for now");
        return;
      }
      const myCurrentGasBalance = options.block.gasMap[options.userInfo.userName];
      if ( myCurrentGasBalance < tx.value.depositAmt){
        logToWebPage("I do not have enough gas as escrow to start this remote attestation. I have to quit this competition. Sorry. ")
        return;
      }
      const myCurrentCreditBalance = options.block.creditMap[options.userInfo.userName];
      if ( myCurrentCreditBalance == 0){
        logToWebPage("My credit balance is 0. I have to quit this competition. Sorry. ");
        return;
      }const {blockCid} = options;
      console.log("received a RA task",tx.value, blockCid, cid);
      const vrfMsg = sha256.update(blockCid).update(cid).hex();
      const p = expectNumberOfRemoteAttestatorsToBeVoted / totalCreditForOnlineNodes;
      console.log("VRFing.... this takes some time, please be patient..., ", userInfo, vrfMsg);
      const { proof, value } = ecvrf.vrf(Buffer.from(userInfo.publicKey, 'hex'), Buffer.from(userInfo.privateKey, 'hex'), Buffer.from(vrfMsg, 'hex'));
      console.log("VRF{ proof, value }", { proof:proof.toString('hex'), value: value.toString('hex') });
      console.log("Now running VRF sortition...it also needs some time... please be patient...", userCreditBalance, p);
      const j = sortition.getVotes(value, new Big(userCreditBalance), new Big(p));
      if(j.gt(0)){
        console.log("I am lucky!!!", j.toFixed());
        logToWebPage(`I am lucky!! J is ${j.toFixed()}`);
        const raReqObj = {
          type:'reqRemoteAttestation',
          j:parseInt(j.toFixed()), 
          proof: proof.toString('hex'), 
          value: value.toString('hex'),
          blockHeightWhenVRF: options.block.blockHeight,
          taskCid:cid,
          publicKey:userInfo.publicKey,
          userName:userInfo.userName
        }

        updateLog('req_ra_send', {
          name : userInfo.userName,
          j: parseInt(j.toFixed()),
          blockCid,
          cid,
          proof: proof.toString('hex')
        });

        window.rooms.townHall.rpcRequest(tx.value.ipfsPeerId, JSON.stringify(raReqObj), async (res, err)=>{
          if(err){
            logToWebPage(`I am a Remote Attestator, I received new node's error response :, err is `, err);
            return console.log(`I am a Remote Attestator, I received new node's error response :, err is `, err);
          }
          logToWebPage(`I am a Remote Attestator, I received new node's reply :, payload is `, res);
          const {proofOfVrf, proofOfTrust} = res;
          const potResult = validatePot(proofOfTrust);
          logToWebPage(`Proof of trust verify result: ${potResult}`);
          const cid = await ipfs.dag.put({potResult,proofOfTrust,proofOfVrf});
          const remoteAttestationDoneMsg = {
            txType:'remoteAttestationDone',
            cid: cid.toBaseEncodedString()
          }
          options.rooms.taskRoom.broadcast(JSON.stringify(remoteAttestationDoneMsg))
          logToWebPage(`Broadcast in taskRoom about the Proof of trust verify result: ${potResult}`);

          const {userInfo} = options;
          updateLog('res_ra', {
            name : userInfo.userName,
            from : tx.value.ipfsPeerId,
            cid : proofOfVrf.taskCid,
            potResult
          });
          
          
        });
        logToWebPage(`Sending townhall request to the new node: ${tx.value.ipfsPeerId}  for RA:`, raReqObj);

        
      }else{
        updateLog('req_ra_send', {
          name : userInfo.userName,
          j: parseInt(j.toFixed()),
          cid,
        })

        console.log("bad luck, try next", j.toFixed());
        logToWebPage(`bad luck, try next time`);

        
        
      }
            

    })
  });
  
  remoteAttestationDoneTxsCid.map((cid)=>{
    options.ipfs.dag.get(cid).then(tx=>{
      console.log("received a RADone task, not implemented yet",tx.value);
      //logToWebPage(`Blockroom Received a RA Done Message `, tx);
    })
  });

  uploadLambdaTxsCid.map((cid)=>{
    console.log("for upload Lamdba, we do not need to do anything. Just have a record there that in which block height, the CID of this ladba has been recorded. In case of some future search")
  });
  
  computeTaskTxsCid.map(async (cid)=>{
    const tx = await ipfs.dag.get(cid);
    const {userName, depositAmt, executorRequirement, lambdaCid} = tx.value;
    if(userName == userInfo.userName){
      console.log("I am the task owner myself, I cannot do execution compute task on myself, skip");
      return;
    }
    const lambda = (await ipfs.dag.get(lambdaCid)).value;
    if(lambda.ownerName == userInfo.userName){
      console.log("I am the lambda owner myself, I cannot do execution compute task because I wrote the code, skip");
      return;
    }

    if(depositAmt < 0){
      console.log(`amt has to be greater than 0, otherwise he is stealing money from you: ${tx.value.depositAmt}. computTask abort now`);
      logToWebPage(`amt has to be greater than 0, otherwise he is stealing money from you: ${tx.value.depositAmt}. computTask abort now`);
      return;
    }
    const myCurrentGasBalance = options.block.gasMap[options.userInfo.userName];
    
    if ( myCurrentGasBalance < depositAmt){
      logToWebPage("I do not have enough gas as escrow to start this compute task. I have to quit this competition. Sorry. ")
      return;
    }
    const myCurrentCreditBalance = options.block.creditMap[options.userInfo.userName];
    if ( myCurrentCreditBalance < executorRequirement.credit){
      logToWebPage(`My credit balance is ${myCurrentCreditBalance} which is lower than the task client required ${executorRequirement.credit}. I have to quit this competition. Sorry. `);
      return;
    }
    const {blockCid} = options;
    //console.log("received a RA task",tx.value, blockCid, cid);
    const vrfMsg = sha256.update(blockCid).update(cid).hex();
    const p = expectNumberOfExecutorGroupToBeVoted / totalCreditForOnlineNodes;
    console.log("VRFing.... this takes some time, please be patient..., ", userInfo, vrfMsg);
    const { proof, value } = ecvrf.vrf(Buffer.from(userInfo.publicKey, 'hex'), Buffer.from(userInfo.privateKey, 'hex'), Buffer.from(vrfMsg, 'hex'));
    console.log("VRF{ proof, value }", { proof:proof.toString('hex'), value: value.toString('hex') });
    console.log("Now running VRF sortition...it also needs some time... please be patient...", userCreditBalance, p);
    const j = sortition.getVotes(value, new Big(userCreditBalance), new Big(p));
    if(j.gt(0)){
      console.log("I am lucky!!!", j.toFixed());
      logToWebPage(`I am lucky!! J is ${j.toFixed()}. However I should not tell anyone about my win. Do not want to get hacker noticed. I just join the secure p2p chat group for winner's only`);
      if (! options.computeTaskGroup){
        options.computeTaskGroup = {};
      }
      if(! options.computeTaskGroup[cid])
        options.computeTaskGroup[cid] = [];
      options.computeTaskGroup[cid].push({
        ipfsPeerId: userInfo.ipfsPeerId,
        userName: userInfo.userName,
        j: j.toFixed(),
        proof:proof.toString('hex'),
        value:value.toString('hex'),
        blockHeightWhenVRF: options.block.blockHeight
      });
      
      const applicationJoinSecGroup = {
        txType:'computeTaskWinnerApplication',
        ipfsPeerId: userInfo.ipfsPeerId,//peerId for myself
        userName: options.userInfo.userName,
        publicKey: options.userInfo.publicKey,
        taskCid: cid,
        proof:proof.toString('hex'),
        value: value.toString('hex'),
        j: j.toFixed(),
        blockHeightWhenVRF: options.block.blockHeight
      };
    
      //window.rooms.townHall.broadcast(JSON.stringify(applicationJoinSecGroup));
      window.rooms.taskRoom.broadcast(JSON.stringify(applicationJoinSecGroup));
    
      logToWebPage(`I am asking to join the secure chatting group by sending everyone in this group my application`, applicationJoinSecGroup);
      
    }else{
      // updateLog('req_ra_send', {
      //   name : userInfo.userName,
      //   j: parseInt(j.toFixed()),
      //   cid,
      // })

      console.log("bad luck, try next", j.toFixed());
      logToWebPage(`bad luck, try next time`);
    }
    
  });

  computeTaskWinnerApplicationCid.map(async (cid)=>{
    
  })
}

const handlePendingTasks =  (options, totalGas, totalCredit, totalCreditForOnlineNodes)=>{
  if(options.computeTaskGroup){
    const computeTaskCids = Object.keys(options.block.pendingTasks).filter((k)=>options.block.pendingTasks[k].type == 'computeTask');
    computeTaskCids.forEach(async c=>{
      const task = options.block.pendingTasks[c];
      if(eligibilityCheck(options.block.blockHeight, task) == 'timeUp'){
        const executor = chooseExecutorAndMonitors(task);
        console.log("executor is,", executor.userName);
        if(options.userInfo.userName == executor.userName){
          logToWebPage("I am the executor. I am going to run taskCid:", c);
          executeCompute(options, c, executor);
        }else{
          logToWebPage(`I am the monitor, the executor is ${executor.userName}`);
        }
      }
    })
  }
}

const verifyBlockIntegrity = (options)=>{
  //Place holder, did not do anything yet, assume the block is valid
  return true;
}



const setEleValue = (id, newValue)=>{
  if(!document.getElementById(id))return;
  if(document.getElementById(id).innerHTML != newValue){
    document.getElementById(id + "_was")? document.getElementById(id + "_was").innerHTML = document.getElementById(id).innerHTML : null;
    document.getElementById(id).innerHTML = newValue;;
    document.getElementById(id).style.color = '#d00';
  }
  else{
    document.getElementById(id).style.color = '#000'
    document.getElementById(id + "_was")? document.getElementById(id + "_was").innerHTML = "": null;
  }
}

const updateNodeStatusOnNewBlock = ({block, userInfo} , totalGas, totalCredit, totalCreditForOnlineNodes)=>{
  const userName = userInfo.userName;
  const blockHeight = block.blockHeight;
  const gasBalance = block.gasMap[userName] || "";
  const creditBalance = block.creditMap[userName] || "";
  setEleValue('blockheight', blockHeight);
  setEleValue('gasbalance', gasBalance);
  setEleValue('creditbalance', creditBalance);
  setEleValue('totalgas', totalGas);
  setEleValue('totalcredit', totalCredit);
  setEleValue('totalcredit_onlineonly', totalCreditForOnlineNodes);
  
}


const blockRoom = (ipfs, room, options) => {
  const messageHandlers = [];
  
  const peerJoinedHandler = (peer)=>console.log('peer ' + peer + ' joined block room');
  messageHandlers.push({message: 'peer joined', handler: peerJoinedHandler});
  const peerLeftHandler = (peer) => console.log('peer ' + peer + ' left block room');
  messageHandlers.push({message: 'peer left', handler: peerLeftHandler});
  messageHandlers.push({message:'subscribed', handler: (m) => {console.log("...... subscribe....", m)}});
  messageHandlers.push({
    message: 'message',
    handler: async (message) => {
      
      const blockObj = tryParseJson(message.data);
      if(typeof blockObj == 'undefined'){
        
        return console.log('In block room got an non-parsable message from ' + message.from + ': ' + message.data.toString());
      }
      const {txType, cid} = blockObj;
      if(txType != 'newBlock'){
        return console.log('In block room got an unhandled message from ' + message.from + ': ' + message.data.toString());
      }
      const block = await ipfs.dag.get(cid);
      if(! options.blockHistory)  options.blockHistory = {};
      options.blockHistory[block.value.blockHeight] = cid;
      console.log("received block height=", block.value.blockHeight);
      //logToWebPage(`Received new block Height: ${block.value.blockHeight}`);
      if(options.isProcessingBlock){
        throw new Exceptions("Racing conditions found. Some async funciton is processing block while new block just came in, how to handle this issue?");
      }
      options.block = block.value;
      options.blockCid = cid;
      options.isProcessingBlock = true;
      processNewBlock(options);
      options.isProcessingBlock = false;
    }
  });
  return messageHandlers;
};

blockRoom.processNewBlock = processNewBlock;
module.exports = blockRoom;