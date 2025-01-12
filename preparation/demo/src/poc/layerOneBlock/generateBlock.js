import {minRemoteAttestatorsToPassRaTask, initialCreditIssuedWhenPassRa, awardCreditWhenRaSuccessful, penaltyCreditWhenRaFail, reduceFactualIfRaFail} from '../constValue';
import _ from 'lodash';
import {totalCreditToken} from '../constValue';
import Big from 'big.js';
import {log} from '../PotLog';
import {eligibilityCheck, chooseExecutorAndMonitors} from '../computeTask';

exports.generateBlock = async ({ipfs, globalState, blockRoom})=>{
  runSettlementBeforeNewBlock(ipfs, globalState);
  globalState.creditMap = runCreditNormalization(globalState.creditMap, totalCreditToken);
  const {gasMap, creditMap, processedTxs, previousBlockHeight, previousBlockCid, trustedPeerToUserInfo, escrowGasMap, pendingTasks} = globalState;
  
  //calculate totalCredit for online users
  let totalCreditForOnlineNodes = 0;
  for( const c in trustedPeerToUserInfo){
    const currUserInfo = trustedPeerToUserInfo[c];
    totalCreditForOnlineNodes += creditMap[currUserInfo.userName];
  }


  const peerProfile = globalState.peerProfile;

  const newBlock = {
    peerProfile,
    gasMap,
    creditMap,
    processedTxs,
    blockHeight: previousBlockHeight + 1,
    previousBlockCid,
    trustedPeerToUserInfo,
    totalCreditForOnlineNodes,
    escrowGasMap,
    pendingTasks
  };
  globalState.blockHeight = newBlock.blockHeight; 

  globalState.blockCid = "generating new block CID, please wait";//while generating block, set the blockCid to 0 for temperary because of async await, other code may run into globalState.blockCid while await is waiting for new blockCid.
  const newBlockCid = await ipfs.dag.put(newBlock);
  globalState.blockCid = newBlockCid.toBaseEncodedString();
  const broadcastObj = {
    txType:'newBlock',
    cid:newBlockCid.toBaseEncodedString()
  }
  // console.log("before blockRoom broadcast, the obj,", broadcastObj)
  blockRoom.broadcast(JSON.stringify(broadcastObj))
  globalState.previousBlockHeight = globalState.blockHeight;
  globalState.processedTxs = [];
  globalState.blockHistory[globalState.blockHeight] = globalState.blockCid;
  return newBlock;
}

const runSettlementBeforeNewBlock = (ipfs, globalState)=>{
  if(! globalState.pendingTasks)  return;

  const pendingTasks = globalState.pendingTasks;

  const promisesTasks = Object.keys(pendingTasks).map( async (taskCid)=>{
    const {type, initiator, followUps, startBlockHeight} = pendingTasks[taskCid];
    switch(type){
      case 'newNodeJoinNeedRa':{
        if(followUps.length < minRemoteAttestatorsToPassRaTask){
          break;//we have not reached the minimal requirement of the number of Remote Attestators
        }
        const promisesChildren = followUps.map( async (childCid)=>{
          return (await ipfs.dag.get(childCid)).value;
        });
        const allChildrenTasks = await Promise.all(promisesChildren);
        //console.log('before settleNewNodeRa, globalState gasMap, creditMap, pendingTasks', globalState.gasMap, globalState.creditMap, globalState.pendingTasks)
        if (settleNewNodeRa(initiator, taskCid, globalState, allChildrenTasks)){
          delete pendingTasks[taskCid];
        };
        //console.log('after settleNewNodeRa, globalState gasMap, creditMap, pendingTasks', globalState.gasMap, globalState.creditMap, globalState.pendingTasks)
        break;
      }//case
      case 'computeTask':{
        //console.log('computeTask not implemented yet in runSettlementBeforeNewBlock');
        const result = eligibilityCheck(globalState.blockHeight, pendingTasks[taskCid]);
        if(result == 'needExtend')
          globalState.processedTxs.push(taskCid);
        else if(result == 'timeUp'){
          chooseExecutorAndMonitors(pendingTasks[taskCid]);
          globalState.pendingTasks[taskCid].type = 'computeTaskDone';
        }
        break;
      }
      case 'computeTaskDone':{
        if ( await settleComputeTask(ipfs, globalState, taskCid)){
          delete globalState.escrowGasMap[taskCid];
          delete globalState.pendingTasks[taskCid];
        }
        console.log('case computeTaskDone, gasMap,', globalState.gasMap);
        break;
      }
    }//switch
    return ;
  });//map
  return ;
};

const settleNewNodeRa = (initiator, taskCid, globalState, allChildrenTasks)=>{
  let voteYes = [];
  let voteNo = [];
  let voteResultWeighted = 0;
  
  const newNodeUserName = initiator;
  allChildrenTasks.forEach(t=>{
    if(t.potResult){
      voteResultWeighted += t.proofOfVrf.j;
      voteYes.push(t.proofOfVrf.userName);
    }else{
      voteResultWeighted -= t.proofOfVrf.j;
      voteNo.push(t.proofOfVrf.userName);
    } 
  });
  //console.log('voteYes, voteNo, voteResultWeighted:', {voteYes, voteNo, voteResultWeighted});
  let winnerArray;
  let loserArray;

  if(voteResultWeighted > 0){
    winnerArray = voteYes;
    loserArray = voteNo;
  }else if(voteResultWeighted < 0){
    winnerArray = voteNo;
    loserArray = voteYes;
  }else{
    winnerArray = [];
    loserArray = [];
  }
  
  const totalAwardGas = globalState.escrowGasMap[taskCid];
  
  if (voteResultWeighted > 0) 
    globalState.creditMap[newNodeUserName] += initialCreditIssuedWhenPassRa;
  else
    globalState.creditMap[newNodeUserName] = 0;//reduceFactualIfRaFail;
  const rewardGasToEach = winnerArray.length? totalAwardGas / winnerArray.length : 0;
  winnerArray.forEach(u=>{
    globalState.creditMap[u] += awardCreditWhenRaSuccessful;
    //console.log('user u, add credit', {u, awardCreditWhenRaSuccessful});
    globalState.gasMap[u] += rewardGasToEach;
    //console.log('user u add gas:', {u, rewardGasToEach});

    log('ra_reward', {
      name : u,
      credit : awardCreditWhenRaSuccessful,
      credit_balance : globalState.creditMap[u],
      gas : rewardGasToEach,
      gas_balance : globalState.gasMap[u],
      cid : taskCid
    });
  });
  loserArray.forEach(u=>{
    globalState.creditMap[u] -= penaltyCreditWhenRaFail;
    //console.log('user u, lose gas:', {u, penaltyCreditWhenRaFail});

    log('ra_penalty', {
      name : u,
      credit : penaltyCreditWhenRaFail,
      credit_balance : globalState.creditMap[u],
      cid : taskCid
    });
  });
  
  delete globalState.escrowGasMap[taskCid];
  return true;
}
const runCreditNormalization = (creditMapInput, maxCredit)=>{
  let currentTotalCredit = Object.values(creditMapInput).reduce((accu, c)=>{
    if(!c) c = 0;
    return accu + c;
  }, 0);
  if(Math.abs((currentTotalCredit - maxCredit) / maxCredit ) < 0.01)
    return creditMapInput;
  const inflation = maxCredit - currentTotalCredit;
  const creditMap = {};
  Object.keys(creditMapInput).forEach(k=>{
    const newCredit = creditMapInput[k] * inflation / currentTotalCredit + creditMapInput[k]; //TODO: possible overflow
    creditMap[k] = Math.round(newCredit);
  });
  return creditMap;
};

const settleComputeTask = async (ipfs, globalState, taskCid)=>{
  console.log("gasMap before settleComputeTask,", globalState.gasMap);
  
  const taskInPending = globalState.pendingTasks[taskCid];
  const {followUps} = taskInPending;
  const executor = chooseExecutorAndMonitors(taskInPending);
  console.log('in settleComputeTask executor', executor)
  let totalRewardGasRemaining = globalState.escrowGasMap[taskCid];
  const taskObj = (await ipfs.dag.get(taskCid)).value;
  const lambdaObj = (await ipfs.dag.get(taskObj.lambdaCid)).value;

  const {ownerName, amt} = lambdaObj;
  console.log('in settleComputeTask ownerName', ownerName);
  console.log('in settleComputeTask amt', amt);
  globalState.gasMap[ownerName] += amt;
  totalRewardGasRemaining -= amt;
  const rewardToExecutor = totalRewardGasRemaining / 2;
  console.log('in settleComputeTask rewardToExecutor', rewardToExecutor)
  
  globalState.gasMap[executor.userName] += rewardToExecutor;
  
  totalRewardGasRemaining -= rewardToExecutor;

  if(followUps.length == 1){
    //there is no monitor
    console.log("ERROR: We should always have followups as monitors");
  }else{
    const rewardToEachMonitor = totalRewardGasRemaining / (followUps.length - 1);
    console.log('in settleComputeTask rewardToEachMonitor', rewardToEachMonitor)
  
    followUps.forEach((f)=>{
    const followUpUserName = f.userName;
    console.log('in settleComputeTask followUpUserName', followUpUserName);
  
    if(followUpUserName != executor.userName)
      globalState.gasMap[followUpUserName] += rewardToEachMonitor;

    })
  }
  console.log("gasMap after settleComputeTask,", globalState.gasMap);
  
  return true;
}
exports.runCreditNormalization = runCreditNormalization;