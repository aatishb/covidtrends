// custom graph component
Vue.component('graph', {

  props: ['data', 'dates', 'day', 'selectedData', 'scale', 'resize'],

  template: '<div ref="graph" id="graph" style="height: 100%;"></div>',

  methods: {

    makeGraph() {
      this.autosetRange = true;
      this.updateTraces();
      this.updateLayout();

      Plotly.newPlot(this.$refs.graph, this.traces, this.layout, {responsive: true}).then(e => {
          if (!this.graphMounted) {
            this.$emit('graph-mounted')
            this.graphMounted = true;
          }
        });

      this.$refs.graph.on('plotly_hover', this.onHoverOn)
        .on('plotly_unhover', this.onHoverOff)
        .on('plotly_relayout', this.onLayoutChange);

      this.updateAnimation();
    },

    onLayoutChange(data) {

      //console.log('layout change detected');

      if (data['xaxis.autorange'] && data['yaxis.autorange']) { // by default, override plotly autorange
        data['xaxis.autorange'] = false;
        data['yaxis.autorange'] = false;
        this.autosetRange = true;
        this.updateLayout();
        this.updateAnimation();
      } else if (data['xaxis.range[0]']) { // if range set manually
        this.autosetRange = false; // then use the manual range
        this.xrange = [data['xaxis.range[0]'], data['xaxis.range[1]']].map(e => parseFloat(e));
        this.yrange = [data['yaxis.range[0]'], data['yaxis.range[1]']].map(e => parseFloat(e));
      }

    },

    onHoverOn(data) {

        let curveNumber = data.points[0].curveNumber;
        let name = this.traces[curveNumber].name;
        this.traceIndices = this.traces.map((e,i) => e.name == name ? i : -1).filter(e => e >= 0);

        let update = {'line':{color: 'rgba(254, 52, 110, 1)'}};

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

    updateTraces() {

      let showDailyMarkers = this.data.length <= 2;

      let traces1 = this.data.map((e,i) => ({
        x: e.cases,
        y: e.slope,
        name: e.country,
        text: this.dates.map(f => e.country + '<br>' + f),
        mode: showDailyMarkers ? 'lines+markers' : 'lines',
        type: 'scatter',
        legendgroup: i,
        marker: {
          size: 4,
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
      this.traceCount =  new Array(this.traces.length).fill(0).map((e,i) => i);

      this.filteredCases = Array.prototype.concat(...this.data.map(e => e.cases)).filter(e => !isNaN(e));
      this.filteredSlope =  Array.prototype.concat(...this.data.map(e => e.slope)).filter(e => !isNaN(e));

    },

    updateLayout() {

      //console.log('layout updated');

      if (this.autosetRange) {
        this.setxrange();
        this.setyrange();
        this.autosetRange = false;
      }

      this.layout = {
        title: 'Trajectory of COVID-19 '+ this.selectedData + ' (' + this.dates[this.day - 1] + ')',
        showlegend: false,
        xaxis: {
          title: 'Total ' + this.selectedData,
          type: this.scale == 'Logarithmic Scale' ? 'log' : 'linear',
          range: this.xrange,
          titlefont: {
            size: 18,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        yaxis: {
          title: 'New ' + this.selectedData + ' (in the Past Week)',
          type: this.scale == 'Logarithmic Scale' ? 'log' : 'linear',
          range: this.yrange,
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


    updateAnimation() {

        let traces1 = this.data.map(e => ({
          x: e.cases.slice(0, this.day),
          y: e.slope.slice(0, this.day)
        }));

        let traces2 = this.data.map(e => ({
          x: [e.cases[this.day - 1]],
          y: [e.slope[this.day - 1]]
        }));

        Plotly.animate(this.$refs.graph, {
          data: [...traces1, ...traces2],
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

    setxrange() {
      let xmax = Math.max(...this.filteredCases, 50);

      if (this.scale == 'Logarithmic Scale') {
        this.xrange = [1, Math.ceil(Math.log10(1.5*xmax))]
      } else {
        this.xrange = [-0.49*Math.pow(10,Math.floor(Math.log10(xmax))), Math.round(1.05 * xmax)];
      }

    },

    setyrange() {
      let ymax = Math.max(...this.filteredSlope, 50);

      if (this.scale == 'Logarithmic Scale') {
        this.yrange = [1, Math.ceil(Math.log10(1.25*ymax))]
      } else {
        this.yrange = [-Math.pow(10,Math.floor(Math.log10(ymax))-2), Math.round(1.05 * ymax)];
      }

    },

  },

  mounted() {
    this.makeGraph();
  },

  watch: {

    resize() {
      //console.log('resize detected');
      Plotly.Plots.resize(this.$refs.graph);
    },

    scale() {
      //console.log('scale change detected', this.scale);
       this.makeGraph();
    },

    day(newDay, oldDay) {
      //console.log('day change detected', oldDay, newDay);
      this.updateLayout();
      this.updateAnimation();
    },

    data() {
      //console.log('data change detected');

        this.makeGraph();

        // don't do this the first time the data changes
        if (this.dataChanged) {
          this.$emit('update:day', this.dates.length);
        }

        this.dataChanged = true;
    }

  },

  computed: {
  },

  data() {
    return {
      filteredCases: [],
      filteredSlope: [],
      traces: [],
      layout: {},
      firstTime: true,
      traceCount: [],
      traceIndices: [],
      xrange: [],
      yrange: [],
      autosetRange: true,
      graphMounted: false,
      dataChanged: false,
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

    let url = window.location.href.split('?');

    if (url.length > 1) {

      let urlParameters = new URLSearchParams(url[1]);

      if (urlParameters.has('scale')) {

        let myScale = urlParameters.get('scale').toLowerCase();

        if (myScale == 'log') {
          this.selectedScale = 'Logarithmic Scale';
        } else if (myScale == 'linear') {
          this.selectedScale = 'Linear Scale';
        }
      }

      if (urlParameters.has('data')) {
        let myData = urlParameters.get('data').toLowerCase();
        if (myData == 'cases') {
          this.selectedData = 'Confirmed Cases';
        } else if (myData == 'deaths') {
          this.selectedData = 'Reported Deaths';
        }

      }

      if (urlParameters.has('country')) {
        this.selectedCountries = urlParameters.getAll('country');
      }

    } else {
      this.selectedData = 'Confirmed Cases';
      this.selectedScale = 'Logarithmic Scale';
    }

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
    },

    dates() {
      if (this.graphMounted && this.autoplay) {
        //console.log('autoplaying');
        this.play();
      }
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
       Plotly.d3.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv", this.processData);
      } else if (selectedData == 'Reported Deaths') {
       Plotly.d3.csv("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv", this.processData);
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

      //this.day = this.dates.length;

      let myData = [];
      for (let country of countries){
        let countryData = data.filter(e => e["Country/Region"] == country);
        let arr = [];

        for (let date of dates) {
          let sum = countryData.map(e => parseInt(e[date]) || 0).reduce((a,b) => a+b);
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
      this.autoplay = false; // disable autoplay on first play

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
       //console.log('day', this.day);
       //console.log('incrementing');

      if (this.day < this.dates.length) {
        if (!this.paused) {
          this.day++;
          setTimeout(this.increment, 200);
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
    },

    createURL() {
      let url = 'https://aatishb.com/covidtrends/'

      url = url + '?scale=' + (this.selectedScale == 'Logarithmic Scale' ? 'log' : 'linear');

      url = url + '&data=' + (this.selectedData == 'Confirmed Cases' ? 'cases' : 'deaths');

      for (let country of this.countries) {
        if (this.selectedCountries.includes(country)) {
          url += '&country=' + country;
        }
      }

      alert('Here\'s a custom URL to pull up this view:\n' + url);

    },

  },

  computed: {

    filteredCovidData() {
      return this.covidData.filter(e => this.selectedCountries.includes(e.country));
    },

  },

  data: {

    paused: true,

    whichData: ['Confirmed Cases', 'Reported Deaths'],

    selectedData: '',

    sliderSelected: false,

    day: 7,

    icon: 'icons/play.svg',

    scale: ['Logarithmic Scale', 'Linear Scale'],

    selectedScale: '',

    minCasesInCountry: 50,

    dates: [],

    covidData: [],

    countries: [],

    isHidden: true,

    selectedCountries: ['Australia', 'Canada', 'China', 'France', 'Germany', 'Iran', 'Italy', 'Japan', 'South Korea', 'Spain', 'Switzerland', 'US', 'United Kingdom', 'India', 'Pakistan'],

    graphMounted: false,

    autoplay: true,

  }

})
