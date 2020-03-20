// custom graph component
Vue.component('graph', {

  props: ['data', 'dates', 'days', 'selectedData'],

  template: '<div ref="graph" style="height: 100%;"></div>',

  methods: {

    makeGraph() {
      Plotly.newPlot(this.$refs.graph, this.traces, this.layout, {responsive: true});
      this.update();
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

      let ad1 = this.data.map((e,i) => ({
        x: e.cases.slice(0, this.days),
        y: e.slope.slice(0, this.days)
      }));

      let ad2 = {
        x: ad1.map(e => e.x[e.x.length - 1]),
        y: ad1.map(e => e.y[e.y.length - 1])
      };

      this.animationData = [...ad1, ad2];

    },

    initLayout() {

      this.layout = {
        title: 'COVID-19 Trends (' + this.dates[this.days - 1] +')',
        showlegend: false,
        xaxis: {
          title: 'Total '+this.selectedData,
          type: 'log',
          range: [1.699, 5]
        },
        yaxis: {
          title: 'Recent '+this.selectedData+' (Past Week)',
          type: 'log',
          range: [1.699, 5]
        },
        hovermode: 'closest',
        font: {
                color: "black",
                size: 18
              },
      };

    },

    initTraces() {

      let myTrace = this.data.map(e => ({
        x: [],
        y: [],
        name: e.country,
        mode: 'lines+text',
        type: 'scatter',
        line: {
          color: 'rgba(0,0,0,0.15)'
        }
      })
      );

      myTrace.push({
        x: [],
        y: [],
        text: this.data.map(e => e.country),
        mode: 'markers+text',
        type: 'scatter',
        textposition: 'top left',
        marker: {
          size: 8,
          color: 'rgba(220, 20, 20, 1)'
        }
      })

      this.traces = myTrace;
    }

  },

  mounted() {
    this.initTraces();
    this.initLayout();
    this.makeGraph();
  },

  watch: {

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
      traces: [],
      traceCount: [],
      animationData: []
    }
  }

})

// global data
let app = new Vue({

  el: '#root',

  mounted() {
    this.pullData(this.selectedData);
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

          myData.push({
            country: country,
            cases: arr,
            slope: slope,
          });

        }
      }

      this.covidData = myData.filter(e => e.cases[e.cases.length - 1] >= this.minCasesInCountry)
        .sort((a,b) => a.cases[a.cases.length - 1] < b.cases[b.cases.length - 1]);

      this.countries = this.covidData.map(e => e.country).sort();

    },

    play() {

      this.paused = false;
      this.day = 7;
      this.increment();

    },

    pause() {
      this.paused = true;
    },

    increment() {

      if (this.day < this.dates.length && !this.paused) {
        this.day++;
        setTimeout(this.increment, 50);
      }

    },


  },

  data: {

    paused: false,

    whichData: ['Confirmed Cases', 'Deaths'],

    selectedData: 'Confirmed Cases',

    day: NaN,

    minCasesInCountry: 50,

    dates: [],

    covidData: [],

    countries: [],

    selectedCountries: ['US', 'China', 'India', 'Iran', 'Italy', 'France', 'Germany', 'Korea, South', 'Japan', 'Singapore', 'Spain', 'United Kingdom', 'Australia', 'Malaysia', 'Pakistan', 'Canada'],

  }

})
