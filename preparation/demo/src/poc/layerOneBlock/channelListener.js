import townHallMessageHandler from './townHallMessageHandler';
import taskRoomMessageHandler from './taskRoomMessageHandler';
import blockRoomMessageHandler from './blockRoomMessageHandler';
import Room from 'ipfs-pubsub-room';
import townHallJoinLeftHandler from './townHallJoinLeftHandler';

const createRandomGeoLocation = (n)=>{
  var data=[];   
  for (var i=0; i < n; i++) {
    var aaa = GetRandomNum(-179,179)+Math.random();
    var bbb = GetRandomNum(-40,89)+Math.random();
    data.push([aaa, bbb]);
  }
  function GetRandomNum(Min,Max){   
    var Range = Max - Min;   
    var Rand = Math.random();   
    return(Min + Math.round(Rand * Range));   
  } 
  return data;
};


const createGenesysBlock = (ipfs, presetUsers)=>{
  console.log("**** Generating Genesis Block **** In our demo, we assume everytime we start the system we will start from the very beginning...")
  const block = {};
  block.txPool = [];
  block.gasMap = {};
  block.creditMap = {};
  block.peerProfile = {};
  let totalGas = 0;
  let totalCredit = 0;

  const locs = createRandomGeoLocation(presetUsers.length);
  for(let i = 0; i < presetUsers.length; i ++){
    const u = presetUsers[i];
    block.gasMap[u.name] = i * 100 + 20; //we add 20 to make sure User#0 still have 20 gas in his account;
    totalGas += block.gasMap[u.name];
    block.creditMap[u.name] = i; // we do not add 20, so that User#0 will have money to pay for RA, but he doesn't have credit, that means he is not trustable yet
    totalCredit += block.creditMap[u.name];
    block.peerProfile[u.name] = {
      loc : locs[i]
    };
  }
  block.totalGas = totalGas;
  block.totalCredit = totalCredit;
  block.latestBlockHeight = 0;
  return block;

}


exports.channelListener = (ipfs, randRoomPostfix, presetUsers)=>{
  
  //We assume every time we start the demo, it starts from genesis block
  const globalState = createGenesysBlock(ipfs, presetUsers);
  const options = {globalState};//default placeholder
  const rooms = {};
  const taskRoom = Room(ipfs, 'taskRoom' + randRoomPostfix);
  taskRoom.on('peer joined', (peer)=>peer);//console.log(console.log('peer ' + peer + ' joined task room')));
  taskRoom.on('peer left', peer=>peer);//console.log('peer ' + peer + ' left task room'));
  taskRoom.on('subscribed', (m) => console.log("...... subscribe task room....", m));
  taskRoom.on('message', taskRoomMessageHandler(ipfs, rooms.taskRoom, options));

  
  const townHall = Room(ipfs, 'townHall' + randRoomPostfix);
  townHall.on('peer joined', townHallJoinLeftHandler.join(ipfs, townHall, options));
  townHall.on('peer left', townHallJoinLeftHandler.left(ipfs, townHall, options));
  townHall.on('subscribed', (m) => console.log("...... subscribe task room....", m));
  townHall.on('message', townHallMessageHandler(ipfs, rooms.townHall, options));

  const blockRoom = Room(ipfs, 'blockRoom' + randRoomPostfix);
  blockRoom.on('peer joined', (peer)=>peer);//console.log(console.log('peer ' + peer + ' joined task room')));
  blockRoom.on('peer left', peer=>peer);//console.log('peer ' + peer + ' left task room'));
  blockRoom.on('subscribed', (m) => console.log("...... subscribe task room....", m));
  blockRoom.on('message', blockRoomMessageHandler(ipfs, rooms.blockRoom, options));

  return {ipfs, globalState, pubsubRooms:{taskRoom, townHall, blockRoom}};
}
