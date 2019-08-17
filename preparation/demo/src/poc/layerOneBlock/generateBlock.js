


exports.generateBlock = async ({ipfs, globalState, blockRoom})=>{
  //console.log("generating block, globalState:", globalState);
  const gasMap = globalState.gasMap;
  const creditMap = globalState.creditMap;
  const processedTxs = globalState.txPool;
  const previousBlockHeight = globalState.blockHeight || 0;
  const previousBlockCid = globalState.blockCid || "";
  const trustedPeerToUserInfo = globalState.trustedPeerToUserInfo || {};
  const escrowGasMap = globalState.escrowGasMap || {};

//calculate totalCredit for online users
  let totalCreditForOnlineNodes = 0;
  for( const c in trustedPeerToUserInfo){
    const currUserInfo = trustedPeerToUserInfo[c];
    totalCreditForOnlineNodes += creditMap[currUserInfo.userName];
  }


  globalState.txPool = [];
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
    escrowGasMap
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
  return newBlock;
}

