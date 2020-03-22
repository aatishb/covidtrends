// custom graph component
Vue.component('graph', {

  props: ['data', 'dates', 'days', 'selectedData', 'scale', 'resize'],

  template: '<div ref="graph" id="graph" style="height: 100%;"></div>',

  methods: {

    makeGraph() {

      Plotly.newPlot(this.$refs.graph, this.traces, this.layout, {responsive: true}).then(e => {
          if (this.firstTime) {
            this.$emit('graph-mounted')
            this.firstTime = false;
          }
        });

      this.$refs.graph.on('plotly_hover', this.onHoverOn).on('plotly_unhover', this.onHoverOff);

      if (!this.firstTime) {
        this.update();
      }
    },

    onHoverOn(data) {

        let curveNumber = data.points[0].curveNumber;
        let name = this.traces[curveNumber].name;

        this.traceIndices = this.traces.map((e,i) => e.name == name ? i : -1).filter(e => e >= 0);

        let update = {'line':{color: 'rgba(254, 52, 110,,1)'}};

        for (let i of this.traceIndices) {
          Plotly.restyle(this.$refs.graph, update, [i]);
        }

    },

    onHoverOff(data) {

        let update = {'line':{color: 'rgba(0,0,0,0.15)'}};
        for (let i of this.traceIndices) {
          Plotly.restyle(this.$refs.graph, update, [i]);
        }

    },

    update() {

        this.updateXY();

        Plotly.animate(this.$refs.graph, {
          data: this.animationData,
          traces: this.traceCount,
          layout: this.layout
        }, {
          transition: {
            duration: 0
          },
          frame: {
            // must be >= transition duration
            duration: 0,
            redraw: true
          }
        });

    },

    updateXY() {

      this.traceCount = new Array(this.traces.length).fill(0).map((e,i) => i);

      let traces1 = this.data.map(e => ({
        x: e.cases.slice(0, this.days),
        y: e.slope.slice(0, this.days)
      }));

      let traces2 = this.data.map(e => ({
        x: [e.cases[this.days - 1]],
        y: [e.slope[this.days - 1]]
      }));

      this.animationData = [...traces1, ...traces2];

    },

    initLayout() {

      this.layout = {
        title: 'Trajectory of COVID-19 '+ this.selectedData + ' (' + this.dates[this.days - 1] + ')',
        showlegend: false,
        xaxis: {
          title: 'Total ' + this.selectedData,
          type: this.scale == 'Logarithmic Scale' ? 'log' : 'linear',
          autorange: true,
          titlefont: {
            size: 18,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        yaxis: {
          title: 'New ' + this.selectedData + ' (in the Past Week)',
          type: this.scale == 'Logarithmic Scale' ? 'log' : 'linear',
          autorange: true,
          titlefont: {
            size: 18,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        hovermode: 'closest',
        font: {
                color: "black",
                size: 12
              },
      };

    },

    initTraces() {

      let traces1 = this.data.map((e,i) => ({
        x: e.cases,
        y: e.slope,
        name: e.country,
        text: this.dates.map(f => e.country + '<br>' + f),
        mode: 'lines',
        type: 'scatter',
        legendgroup: i,
        marker: {
          size: 2,
          color: 'rgba(0,0,0,0.15)'
        },
        line: {
          color: 'rgba(0,0,0,0.15)'
        },
        hoverinfo:'x+y+text',
        hovertemplate: '%{text}<br>Total ' + this.selectedData +': %{x:,}<br>Weekly ' + this.selectedData +': %{y:,}<extra></extra>',
      })
      );

      let traces2 = this.data.map((e,i) => ({
        x: [e.cases[e.cases.length - 1]],
        y: [e.slope[e.slope.length - 1]],
        text: e.country,
        name: e.country,
        mode: 'markers+text',
        legendgroup: i,
        textposition: 'top left',
        marker: {
          size: 6,
          color: 'rgba(254, 52, 110, 1)'
        },
        hovertemplate: '%{data.text}<br>Total ' + this.selectedData +': %{x:,}<br>Weekly ' + this.selectedData +': %{y:,}<extra></extra>',

      })
      );

      this.traces = [...traces1, ...traces2];
    }

  },

  mounted() {
    this.initTraces();
    this.initLayout();
    this.makeGraph();
  },

  watch: {

    resize() {
      Plotly.Plots.resize(this.$refs.graph);
    },

    scale() {
      this.initTraces();
      this.initLayout();
      this.makeGraph();
    },

    days() {
      this.initLayout();
      this.update();
    },

    data() {
      this.initTraces();
      this.initLayout();
      this.makeGraph();
    }

  },

  data() {
    return {
      xrange: [],
      yrange: [],
      traces: [],
      traceCount: [],
      traceIndices: [],
      animationData: [],
      firstTime: true
    }
  }

})

// global data
let app = new Vue({

  el: '#root',

  mounted() {
    this.pullData(this.selectedData);
  },

  created: function() {
    window.addEventListener('keydown', e => {

      if ((e.key == ' ') && this.dates.length > 0) {
        this.play();
      }

      else if ((e.key == '-' || e.key == '_') && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.max(this.day - 1, 8);
      }

      else if ((e.key  == '+' || e.key == '=') && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.min(this.day + 1, this.dates.length)
      }

    });
  },


  watch: {
    selectedData() {
      this.pullData(this.selectedData);
    }
  },

  computed: {
    filteredCovidData() {
      return this.covidData.filter(e => this.selectedCountries.includes(e.country));
    }
  },

  methods: {

    myMax() { //https://stackoverflow.com/a/12957522
      var par = []
      for (var i = 0; i < arguments.length; i++) {
          if (!isNaN(arguments[i])) {
              par.push(arguments[i]);
          }
      }
      return Math.max.apply(Math, par);
    },

    pullData(selectedData) {

      if (selectedData == 'Confirmed Cases') {
       Plotly.d3.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv", this.processData);
      } else if (selectedData == 'Deaths') {
       Plotly.d3.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv", this.processData);
      }
    },

    removeRepeats(array) {
      return [...new Set(array)];
    },

    processData(data) {

      let countriesToLeaveOut = ['Cruise Ship'];

      let renameCountries = {
        'Taiwan*': 'Taiwan',
        'Korea, South': 'South Korea'
      };

      let countries = data.map(e => e["Country/Region"]);
      countries = this.removeRepeats(countries);

      let dates = Object.keys(data[0]).slice(4);
      this.dates = dates;

      this.day = this.dates.length;

      let myData = [];
      for (let country of countries){
        let countryData = data.filter(e => e["Country/Region"] == country);
        let arr = [];

        for (let date of dates) {
          let sum = countryData.map(e => parseInt(e[date])).reduce((a,b) => a+b);
          arr.push(sum);
        }

        if (!countriesToLeaveOut.includes(country)) {

          let slope = arr.map((e,i,a) => e - a[i - 7]);

          if (Object.keys(renameCountries).includes(country)) {
            country = renameCountries[country];
          }

          myData.push({
            country: country,
            cases: arr.map(e => e >= this.minCasesInCountry ? e : NaN),
            slope: slope.map((e,i) => arr[i] >= this.minCasesInCountry ? e : NaN),
          });

        }
      }

      this.covidData = myData.filter(e => this.myMax(...e.cases) >= this.minCasesInCountry);
      this.countries = this.covidData.map(e => e.country).sort();

    },

    play() {

      if (this.paused) {
        if (this.day == this.dates.length) {
          this.day = 7;
        }
        this.paused = false;
        this.icon = 'icons/pause.svg';
        this.increment();
      } else {
        this.paused = true;
        this.icon = 'icons/play.svg';
      }

    },

    pause() {
      if(! this.paused) {
        this.paused = true;
        this.icon = 'icons/play.svg';
      }
    },

    increment() {

      if (this.day < this.dates.length) {
        if (!this.paused) {
          this.day++;
          setTimeout(this.increment, 150);
        }
      } else if (this.day == this.dates.length) {
        this.paused = true;
        this.icon = 'icons/play.svg';
      }

    },

    selectAll() {
      this.selectedCountries = this.countries;
    },

    deselectAll() {
      this.selectedCountries = [];
    },

    changeScale() {
      this.selectedScale = (this.selectedScale + 1) % 2;
    },

    toggleHide() {
      this.isHidden = !this.isHidden;
    }

  },

  data: {

    paused: true,

    whichData: ['Confirmed Cases', 'Deaths'],

    selectedData: 'Confirmed Cases',

    sliderSelected: false,

    day: NaN,

    icon: 'icons/play.svg',

    scale: ['Logarithmic Scale', 'Linear Scale'],

    selectedScale: 'Logarithmic Scale',

    minCasesInCountry: 50,

    dates: [],

    covidData: [],

    countries: [],

    isHidden: true,

    selectedCountries: ['Australia', 'Canada', 'China', 'France', 'Germany', 'Iran', 'Italy', 'Japan', 'South Korea', 'Spain', 'Switzerland', 'US', 'United Kingdom', 'India', 'Pakistan'],



  }

})
