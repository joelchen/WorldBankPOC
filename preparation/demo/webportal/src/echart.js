const EChart = class {
  constructor(dom, opts){
    this.dom = dom;
    this.chart = echarts.init(this.dom);

    this.user = opts.user;


    this.buildCallback(opts);
  }
  buildCallback(opts){
    this.chart.on('click', (e)=>{
      const d = e.data;
      opts.click(d);
    });
  }

  render(data, cb){
    this.loading(true);
    data = util.processData(data);
    const option = this.getOption({data});
    this.chart.setOption(option);
    cb && cb();
    this.loading(false);
  }

  loading(f=false){
    if(f){
      this.chart.showLoading();
    }
    else{
      this.chart.hideLoading();
    }
  }

  getOption(opts={}){
    const option = {
      backgroundColor: '#000',
      geo: {
        map: 'world',
        silent: true,
        label: {
            emphasis: {
                show: false,
                areaColor: '#fff'
            }
        },
        itemStyle: {
            normal: {
                borderWidth: 0.2,
                borderColor: 'red'
            }
        },
        left: 24,
        top: 50,
        // bottom: '%',
        right: 24,
        roam: true,
        scaleLimit: {
          min: 0.8,
          max: 4
        },
        itemStyle: {
            normal: {
              areaColor: '#323c48',
              borderColor: '#eee'
            }
        }
      },

      series : [
        {
          name: 'node',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: opts.data || [],
          // symbol: 'diamond',
          // symbol: 'path://M832 160 192 160c-38.4 0-64 32-64 64l0 448c0 38.4 32 64 64 64l256 0 0 64L352 800C332.8 800 320 812.8 320 832c0 19.2 12.8 32 32 32l320 0c19.2 0 32-12.8 32-32 0-19.2-12.8-32-32-32L576 800l0-64 256 0c38.4 0 64-32 64-64l0-448C896 192 864 160 832 160zM832 672l-640 0 0-448 640 0 0 0L832 672z',
          symbolSize: (val)=>{
            return util.symbolSize(val[2]);
          },
          showEffectOn: 'render',
          rippleEffect: {
            brushType: 'stroke'
          },
          hoverAnimation: true,
          
          label: {
              normal: {
                formatter: '{b}',
                position: 'right',
                show: true
              }
          },
          itemStyle: {
            normal: {
              color: (e)=>{
                const d = e.data;
                if(this.user.name === d.peerId){
                  return '#e9e9e9';
                }
                if(d.hacked){
                  return '#f00';
                }
                if(d.creditScore < 1){
                  return '#ff0';
                }

                return '#0f0';
              },
              shadowBlur: 10,
              shadowColor: '#333'
            }
          },
          zlevel: 1,
          tooltip: {
            formatter: (e)=>{
              const d = e.data;
              return this.tooltipFormatter(d);
            }
          }
        }
      ],
      tooltip: {
        show: true
      }

    };

    return option;
  }


  tooltipFormatter(d){
    return `
      ${d.hacked ? 'Hacked <br/>' : ''}
      ${d.creditScore < 1 ? 'Untrusted <br/>' : ''}
      ${d.hacked || d.creditScore < 1 ? '<div style="height:1px; background:#cdcdcd;"></div>' : ''}
      peerId: ${d.peerId} <br/>
      score: ${d.creditScore} <br/>
      gas: ${d.gas} <br/>
    `;
  }
};

module.exports = EChart;