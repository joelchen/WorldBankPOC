const MyIpfs = require('../../src/shared/MyIpfs');
const IPFS = require('ipfs');
const PeerId = require('peer-id');
const EChart = require('./echart');
const Data = require('./data');
import {tryParseJson} from '../../src/poc/constValue';
import blockRoomHandler from '../../src/poc/simulatorSrc/blockRoom';
import townHallHandler from '../../src/poc/simulatorSrc/townHall';
import taskRoomHandler from '../../src/poc/simulatorSrc/taskRoom';

let _n = 1;
const log = (str)=>{
  str = `[${_n}] => `+str;
  const html = MyIpfs.log(str);
  $('.js_html').prepend(html);
  _n++;
}

const C = {
  blockRoom : 'blockRoom',
  taskRoom : 'taskRoom',
  townHall : 'townHall',
  user : null,
  r : null,

  pot_log : {}
};

let options = null;

let myIpfs = null;
let myChart = null;
let myData = null;
let blockRoom, taskRoom, townHall;
const F = {
  loading(f=false){
    if(f){
      $.fakeLoader({
        timeToHide : 999999,
        bgColor : 'rgba(0,0,0,0.7)'
      });
    }
    else{
      $('.fakeLoader').hide();
    }
  },
  async init(){
    const params = util.getUrlParam();
    C.user = {
      name : params.u,
      pub : params.pub,
      pri : params.pri
    };

    window.current_user = C.user;
    C.r = params.r;
    C.blockRoom = 'blockRoom'+params.r;
    C.taskRoom = 'taskRoom'+params.r;
    C.townHall = 'townHall'+params.r;

    myIpfs = new MyIpfs(params.s);
    myChart = new EChart($('#echart-div')[0], {
      user: C.user,
      click(d){
        if(!d) return false;
        
        const el = $('#js_node_detail');
        el.data('json', d).modal('show');
        _.delay(()=>{
          el.find('.js_title').html('Peer : '+ d.name);
          el.find('.js_score').html(d.creditScore);
          el.find('.js_gas').html(d.gas);
          el.find('.js_geo').html(d.location.join(' - '));
          el.find('.js_ipfs').html(d.ipfs_id);

          // if(d.peerId !== C.user.name){
          //   el.find('.js_me').hide();
          //   el.find('.js_other').show();
          // }
          // else{
          //   el.find('.js_me').show();
          //   el.find('.js_other').hide();
          // }
          el.find('.js_me').show();
        }, 100);
      }
    });
    myData = new Data(myIpfs);
    window.myData = myData;

    await myIpfs.start();
    window.myIpfs = myIpfs;

    options = this.buildHandlerOption();
    F.initBlockRoom();
    F.initTaskRoom();
    F.initTownHall();
    window.rooms = {
      taskRoom, blockRoom, townHall
    };
    options.rooms = window.rooms;

    myChart.render();

    F.initLoopData();

    // myChart.render(window.test_data);
  },

  initTaskRoom(){
    let message_hander = ()=>{};
    taskRoom = myIpfs.registerRoom(C.taskRoom, {
      join(peer){
        log('peer ' + peer + ' joined task room');
      },
      left(peer){
        log('peer ' + peer + ' left task room');
      },
      subscribe(m){
        log("...... subscribe .... task room => "+m);
        
      },
      message(msg){
        log('task room got message from ' + msg.from + ': ' + msg.data.toString())
        message_hander(msg);
      }
    });
    // const tmp_cb = taskRoomHandler(myIpfs.node, taskRoom, this.buildHandlerOption());
    // message_hander = (_.find(tmp_cb, (item)=>{
    //   return item.message === 'message';
    // })).handler;
  },
  initBlockRoom(){
    let message_hander = ()=>{};
    blockRoom = myIpfs.registerRoom(C.blockRoom, {
      join(peer){
        log('peer ' + peer + ' joined block room');


      },
      left(peer){
        log('peer ' + peer + ' left block room');

        myData.removePeerByIpfsId(peer);
      },
      subscribe(m){
        log("...... subscribe.... block room => "+m);
        
        F.publishSelfId()
      },
      message(msg){
        log('block room got message from ' + msg.from + ': ' + msg.data.toString())

        message_hander(msg).then(()=>{
          console.log(11, options);
          myData.addBlock({value : options.block});

          log('receive new block, refresh data.');
          const list = myData.getAllListForChart();
          myChart.render(list);
        });
        

      }
    });

    const tmp_cb = blockRoomHandler(myIpfs.node, blockRoom, options);
    message_hander = (_.find(tmp_cb, (item)=>{
      return item.message === 'message';
    })).handler;

    window.blockRoom = blockRoom;
  },
  initTownHall(){
    let message_hander = ()=>{};
    townHall = myIpfs.registerRoom(C.townHall, {
      join(peer){
        log('peer ' + peer + ' joined town hall');
      },
      left(peer){
        log('peer ' + peer + ' left town hall');
      },
      subscribe(m){
        log("...... subscribe .... town hall => "+m);
        
      },
      message(msg){
        log('town hall got message from ' + msg.from + ': ' + msg.data.toString())
        message_hander(msg);
      }
    });

    const tmp_cb = townHallHandler(myIpfs.node, townHall, options);
    message_hander = (_.find(tmp_cb, (item)=>{
      return item.message === 'message';
    })).handler;
  },

  async publishSelfId(){
    const obj = await myIpfs.node.id();
    C.user.ipfs_id = obj.id;
    _.delay(async ()=>{
      await $.ajax({
        url : '/poc/update_ipfs_id', 
        data : {
          user : encodeURIComponent(C.user.name),
          ipfs_id : obj.id
        },
        type : 'get'
      });

      myData.setMyPeer({
        name : C.user.name,
        pub : C.user.pub,
        pri : C.user.pri,
        ipfs_id : obj.id
      });
    }, 100);
  },


  buildHandlerOption(){
    window.ipfs = myIpfs.node;
    return {
      ipfs : myIpfs.node,
      rooms : {},
      userInfo : {
        userName : C.user.name,
        randRoomPostfix : C.r,
        publicKey : C.user.pub,
        privateKey : C.user.pri,
        ipfsPeerId : myIpfs.node._peerInfo.id.toB58String()
      }
    };
  },

  initLoopData(){
    const loop = async ()=>{
      const rs = await $.ajax({
        type : 'get',
        url : '/poc/pot_data',
      });
      const d = rs.data;

      if(d && d.remote_attestation){
        myData.setWorkStatus(d.remote_attestation[d['current']], ()=>{
          const list = myData.getAllListForChart();
          myChart.render(list);
        });
      }
      

      _.delay(async ()=>{
        await loop();
      }, 2000);
    };

    loop();
  }

};


window.poc = {
  createRaTask(){
    const d = $('#js_node_detail').data('json');
    const json = {
      userName : d.name,
      depositAmt : 10,
      ipfsPeerId : d.ipfs_id,
      txType : 'newNodeJoinNeedRa',
    };

    // const config = {
    //   url : '/poc/publish2room',
    //   type : 'post',
    //   data : {
    //     jsontext : JSON.stringify(json),
    //     room : ''
    //   }
    // };

    // $.ajax(config).then((rs)=>{
    //   console.log(rs);
    //   alert('success');
    // })

    const broadcastObj = {
      txType : json.txType
    };
    myIpfs.node.dag.put(json).then((cid)=>{
      broadcastObj.cid = cid.toBaseEncodedString();
      taskRoom.broadcast(JSON.stringify(broadcastObj));
      log("Sent action => "+JSON.stringify(broadcastObj));

      alert('success');
    })


  },
  transferGas(){
    const val = parseInt(prompt('please input the number you what to transfer to him', '10'), 10);

    if(!_.isNumber(val) || _.isNaN(val)){
      alert('invalid input');
      return false;
    }
    
    const d = $('#js_node_detail').data('json');
    const json = {
      fromPeerId: C.user.name,
      toPeerId: d.name,
      amt: val
    };
    // const config = {
    //   url : '/poc/publish2room',
    //   type : 'post',
    //   data : {
    //     jsontext : JSON.stringify(json),
    //     room : ''
    //   }
    // };

    // $.ajax(config).then((rs)=>{
    //   console.log(rs);
    //   alert('success');
    // })

    const broadcastObj = {
      txType : 'gasTransfer',
    };
    myIpfs.node.dag.put(json).then((cid)=>{
      broadcastObj.cid = cid.toBaseEncodedString();
      taskRoom.broadcast(JSON.stringify(broadcastObj));
      log("Sent action: => "+JSON.stringify(broadcastObj));

      alert('success');
    })


  },
  sendTaskMessage(){
    const val = prompt('please leave the message to him', '');

    if(!val){
      alert('invalid input');
      return false;
    }
    
    const d = $('#js_node_detail').data('json');
    townHall.sendTo(d.ipfs_id, val);
    alert('success');
  },

  
};

$(async ()=>{
  F.loading(true);
  await F.init();
  F.loading(false);
})