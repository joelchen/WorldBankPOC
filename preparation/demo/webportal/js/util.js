this.util = {

  createRandomGeoLocation(){
    var data=[];   
    for (var i=0; i < 1; i++) {
      var aaa = GetRandomNum(-179,179)+Math.random();
      var bbb = GetRandomNum(-40,89)+Math.random();
      data.push([aaa, bbb]);
    }
    function GetRandomNum(Min,Max){   
      var Range = Max - Min;   
      var Rand = Math.random();   
      return(Min + Math.round(Rand * Range));   
    } 
    return data[0];
  },

  symbolSize(n){
    let level = 0;
    if(n >= 5 && n < 20){
      level = 1;
    }
    else if(n >= 20 && n < 50){
      level = 2;
    }
    else if(n >= 50 && n < 100){
      level = 3;
    }
    else if(n >= 100){
      level = 4;
    }

    return [
      8, 12, 16, 20, 25
    ][level];
  },

  async requestList(){
    // const data = [
    //   {
    //     peerId : '1',
    //     geo : util.createRandomGeoLocation(),
    //     creditScore : 10,
    //     hacked : true,
    //   },
    //   {
    //     peerId : '2',
    //     geo : util.createRandomGeoLocation(),
    //     creditScore : 32,
    //     hacked : false,
    //   },
    //   {
    //     peerId : '3',
    //     geo : util.createRandomGeoLocation(),
    //     creditScore : 100,
    //     hacked : false
    //   }
    // ];

    return new Promise((resolve)=>{
      $.ajax({
        url : '/poc/potList',
        type : 'get',
        success : (rs)=>{
          resolve(rs.data);
        }
      });
    })
  },

  processData(data){
    return _.map(data, (item)=>{
      item.name = item.peerId,
      item.value = [...item.location, item.creditScore];
      return item;
    });
  }
};