const _ = require('lodash');

const Data = class {
  constructor(myIpfs){
    this.myIpfs = myIpfs;

    this.me = {};

    this.peer_list = [];
    this.peer_map = {};


    this.block_list = [];
    this.block = null;

    this.work_status = [];
  }


  setMyPeer(peer){
    // this.me = peer;
    // this.peer_map[peer.name] = peer;
  }

  setWorkStatus(list, cb){
    if(!list || list.length === this.work_status.length) return false;
    this.work_status = list;

    if(list.length === 1 && list[0].type === 'new_ra'){
      // new task, reset all status;
      this.resetWorkStatus();
    }

    console.log('work status => ', this.work_status);
    
    _.each(this.work_status, (item)=>{
      if(this.peer_map[item.name]){
        this.peer_map[item.name].status = item.type;
        this.peer_map[item.name].pd = item;
      }

    });

    cb && cb();
  }

  resetWorkStatus(){
    _.each(this.peer_map, (val, k)=>{
      delete this.peer_map[k].status;
      delete this.peer_map[k].pd;
    });

    console.log('------ reset work status ------');
  }

  removePeerById(id){
    _.remove(this.peer_list, (item)=>{
      return item.name === id;
    });
    delete this.peer_map[id];
  }
  removePeerByIpfsId(ipfs_id){
    const tmp = _.find(this.peer_list, (item)=>{
      return item.ipfs_id === ipfs_id;
    });
    if(tmp){
      this.removePeerById(tmp.name);
    }
  }

  addBlock(block){
    console.log('add block => ', block);
    this.block_list.push(block);
    this.block = block;

    this.refreshPeerList();
  }
  getCurrentBlock(){
    return this.block ? this.block.value : null;
  }
  refreshPeerList(){
    const block = this.getCurrentBlock();
    const list = [];
    _.each(block.trustedPeerToUserInfo, (val, ipfs_id)=>{
      list.push({
        name: val.userName,
        ipfs_id
      })
    });
    const peer_list = list;  //_.concat(this.me, list);
    this.peer_list = _.map(peer_list, (item)=>{
      if(!this.peer_map[item.name]){
        this.peer_map[item.name] = {};
      }
      const tmp = this.peer_map[item.name];
      tmp.profile = this.getProfile(item.name);
      tmp.profile.ipfs_id = item.ipfs_id;
      this.peer_map[item.name] = tmp;
      return tmp;
    });
  }

  getProfile(name){
    const block = this.getCurrentBlock();
    return {
      location : block.peerProfile[name].loc,
      peerId : name,
      gas : block.gasMap[name],
      creditScore : block.creditMap[name]
    };
  }

  getAllListForChart(){
    return _.map(this.peer_list, (item)=>{
      const tmp = item.profile;
      tmp.status = item.status;
      tmp.pd = item.pd;
      return tmp;
    });
  }

  

};



module.exports = Data;