// custom graph component
Vue.component('graph', {

  props: ['data', 'dates', 'day', 'selectedData', 'scale', 'resize', 'timeWindow', 'isPerCapita'],

  template: '<div ref="graph" id="graph" style="height: 100%;"></div>',

  methods: {

    makeGraph() {
      this.autosetRange = true;
      this.updateTraces();
      this.updateLayout();

      Plotly.newPlot(this.$refs.graph, this.traces, this.layout, this.config).then(e => {
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
        hovertemplate: '%{text}<br>Total ' + this.selectedData +': %{x:,}<br>' + this.selectedData +' in the last ' + this.timeWindow + ' days: %{y:,}<extra></extra>',
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
        hovertemplate: '%{data.text}<br>Total ' + this.selectedData +': %{x:,}<br>' + this.selectedData +' in the last ' + this.timeWindow + ' days: %{y:,}<extra></extra>',

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

      let labelSuffix = this.isPerCapita ?' per million' : '';
      this.layout = {
        title: 'Trajectory of COVID-19 '+ this.selectedData + ' (' + this.dates[this.day - 1] + ')',
        showlegend: false,
        xaxis: {
          title: 'Total ' + this.selectedData + labelSuffix,
          type: this.scale == 'Logarithmic Scale' ? 'log' : 'linear',
          range: this.xrange,
          titlefont: {
            size: 24,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        yaxis: {
          title: 'New ' + this.selectedData + labelSuffix + ' (in the Past ' + this.timeWindow + ' days)',
          type: this.scale == 'Logarithmic Scale' ? 'log' : 'linear',
          range: this.yrange,
          titlefont: {
            size: 24,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        hovermode: 'closest',
        font: {
                family: 'Open Sans',
                color: "black",
                size: 14
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
        this.xrange = [Math.log10(Math.max(this.minCasesInCountry, 1)), Math.ceil(Math.log10(1.1*xmax))]
      } else {
        this.xrange = [-0.49*Math.pow(10,Math.floor(Math.log10(xmax))), Math.round(1.05 * xmax)];
      }

    },

    setyrange() {
      let ymax = Math.max(...this.filteredSlope, 50);

      if (this.scale == 'Logarithmic Scale') {
        this.yrange = [-1, Math.ceil(Math.log10(1.1*ymax))]
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

    selectedData() {
      //console.log('selected data change detected');
      this.$emit('update:day', this.dates.length);
    },

    data() {
      //console.log('data change detected');
      this.makeGraph();
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
      traceCount: [],
      traceIndices: [],
      xrange: [],
      yrange: [],
      autosetRange: true,
      graphMounted: false,
      config: {
          responsive: true,
          toImageButtonOptions: {
            format: 'png', // one of png, svg, jpeg, webp
            filename: 'Covid Trends',
            height: 800,
            width: 1200,
            scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
          }
        },
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

    }

    window.addEventListener('keydown', e => {

      if ((e.key == ' ') && this.dates.length > 0) {
        this.play();
      }

      else if ((e.key == '-' || e.key == '_') && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.max(this.day - 1, this.timeWindow + 1);
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

    timeWindow() {
      this.pullData(this.selectedData);
    },

    perCapita() {
      this.pullData(this.selectedData);
    },

    minCasesInCountry() {
      this.pullData(this.selectedData);
    },

    graphMounted() {
      //console.log('minDay', this.minDay);
      //console.log('autoPlay', this.autoplay);
      //console.log('graphMounted', this.graphMounted);

      if (this.graphMounted && this.autoplay && this.minDay > 0) {
        //console.log('autoplaying');
        this.day = this.minDay;
        this.play();
        this.autoplay = false; // disable autoplay on first play
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

    myMin() {
      var par = []
      for (var i = 0; i < arguments.length; i++) {
          if (!isNaN(arguments[i])) {
              par.push(arguments[i]);
          }
      }
      return Math.min.apply(Math, par);
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

      let countriesToLeaveOut = ['Cruise Ship', 'Diamond Princess'];

      let renameCountries = {
        'Taiwan*': 'Taiwan',
        'Korea, South': 'South Korea'
      };

      let contrySizes = {
        'Afghanistan': 36670000,
        'Albania': 2910000,
        'Algeria': 45000000,
        'Andorra': 80000,
        'Antigua and Barbuda': 100000,
        'Argentina': 42670000,
        'Armenia': 2980000,
        'Aruba': 110000,
        'Australia': 25200000,
        'Austria': 9000000,
        'Azerbaijan': 11000000,
        'Bahamas': 380000,
        'Bahrain': 1700000,
        'Bangladesh': 180000000,
        'Barbados': 290000,
        'Belarus': 10200000,
        'Belgium': 11580000,
        'Benin': 10000000,
        'Bermuda': 60000,
        'Bhutan': 1000000,
        'Bolivia': 15000000,
        'Bosnia and Herzegovina': 3200000,
        'Brazil': 213330000,
        'Brunei': 440000,
        'Bulgaria': 7130000,
        'Burkina Faso': 16500000,
        'Cambodia': 18500000,
        'Cameroon': 26000000,
        'Canada': 37960000,
        'CAR': 5000000,
        'Cayman Islands': 70000,
        'Chad': 16670000,
        'Channel Islands': 170000,
        'Chile': 19000000,
        'China': 1445140000,
        'Colombia': 54000000,
        'Congo': 6000000,
        'Costa Rica': 5120000,
        'Croatia': 4070000,
        'Cuba': 11000000,
        'Curaçao': 170000,
        'Cyprus': 1220000,
        'Czechia': 10680000,
        'Denmark': 5780000,
        'Djibouti': 1000000,
        'Dominica': 11330000,
        'DRC': 70000000,
        'Ecuador': 17330000,
        'Egypt': 85330000,
        'El Salvador': 5000000,
        'Equatorial Guinea': 1500000,
        'Estonia': 1330000,
        'Eswatini': 1110000,
        'Ethiopia': 116670000,
        'Faeroe Islands': 50000,
        'Fiji': 1000000,
        'Finland': 5560000,
        'France': 65450000,
        'French Guiana': 300000,
        'French Polynesia': 290000,
        'Gabon': 3000000,
        'Gambia': 2500000,
        'Georgia': 4000000,
        'Germany': 83720000,
        'Ghana': 27500000,
        'Gibraltar': 30000,
        'Greece': 10310000,
        'Greenland': 60000,
        'Guadeloupe': 400000,
        'Guam': 170000,
        'Guatemala': 18000000,
        'Guinea-Bissau': 12500000,
        'Guyana': 830000,
        'Honduras': 12000000,
        'Hong Kong': 7430000,
        'Hungary': 9130000,
        'Iceland': 340000,
        'India': 1940000000,
        'Indonesia': 309000000,
        'Iran': 84050000,
        'Iraq': 38400000,
        'Ireland': 4930000,
        'Isle of Man': 80000,
        'Israel': 8680000,
        'Italy': 60430000,
        'Ivory Coast': 30000000,
        'Jamaica': 3000000,
        'Japan': 134710000,
        'Jordan': 9860000,
        'Kazakhstan': 22000000,
        'Kenya': 70000000,
        'Kuwait': 4230000,
        'Kyrgyzstan': 6000000,
        'Latvia': 1870000,
        'Lebanon': 6830000,
        'Liberia': 5000000,
        'Liechtenstein': 40000,
        'Lithuania': 2670000,
        'Luxembourg': 630000,
        'Macao': 650000,
        'Malaysia': 32140000,
        'Maldives': 540000,
        'Malta': 440000,
        'Martinique': 380000,
        'Mauritania': 5000000,
        'Mauritius': 1170000,
        'Mayotte': 270000,
        'Mexico': 131110000,
        'Moldova': 4080000,
        'Monaco': 40000,
        'Mongolia': 3000000,
        'Montenegro': 620000,
        'Montserrat': 10000,
        'Morocco': 31500000,
        'Namibia': 3000000,
        'Nepal': 33330000,
        'Netherlands': 17080000,
        'New Caledonia': 290000,
        'New Zealand': 4670000,
        'Nicaragua': 5000000,
        'Niger': 25000000,
        'Nigeria': 200000000,
        'North Macedonia': 2080000,
        'Norway': 5420000,
        'Oman': 5330000,
        'Pakistan': 227000000,
        'Palestine': 5220000,
        'Panama': 4280000,
        'Paraguay': 6500000,
        'Peru': 33430000,
        'Philippines': 108500000,
        'Poland': 39440000,
        'Portugal': 10210000,
        'Puerto Rico': 3000000,
        'Qatar': 2880000,
        'Réunion': 900000,
        'Romania': 19790000,
        'Russia': 199000000,
        'Rwanda': 13750000,
        'Korea, South': 51290000,
        'Saint Lucia': 180000,
        'Saint Martin': 40000,
        'San Marino': 30000,
        'Saudi Arabia': 34250000,
        'Senegal': 18000000,
        'Serbia': 8580000,
        'Seychelles': 100000,
        'Singapore': 5850000,
        'Sint Maarten': 40000,
        'Slovakia': 5390000,
        'Slovenia': 2080000,
        'Somalia': 16670000,
        'South Africa': 50000000,
        'Spain': 46710000,
        'Sri Lanka': 20000000,
        'St. Barth': 10000,
        'St. Vincent Grenadines': 110000,
        'Sudan': 40000000,
        'Suriname': 500000,
        'Sweden': 10130000,
        'Switzerland': 8650000,
        'Taiwan': 21600000,
        'Tanzania': 60000000,
        'Thailand': 68000000,
        'Togo': 10000000,
        'Trinidad and Tobago': 1500000,
        'Tunisia': 13000000,
        'Turkey': 89750000,
        'U.S. Virgin Islands': 100000,
        'United Arab Emirates': 10000000,
        'United Kingdom': 68100000,
        'Ukraine': 43330000,
        'Uruguay': 3430000,
        'US': 328310000,
        'Uzbekistan': 32860000,
        'Vatican City': 0,
        'Venezuela': 42000000,
        'Vietnam': 94440000,
        'Zambia': 20000000,
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

        if (!Object.keys(contrySizes).includes(country)) {
          console.log('country didn\'t match: ', country);
          continue;
        }
        let contrySize = contrySizes[country];

        for (let date of dates) {
          let sum = countryData.map(e => parseInt(e[date]) || 0).reduce((a,b) => a+b);
           arr.push(this.perCapita ? sum * 1000000 / contrySize: sum);
        }

        if (!countriesToLeaveOut.includes(country)) {
          let slope = arr.map((e,i,a) => e - a[i - this.timeWindow]);

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
          this.day = this.minDay;
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

      if (this.day == this.dates.length || this.minDay < 0) {
        this.day = this.dates.length;
        this.paused = true;
        this.icon = 'icons/play.svg';
      }
      else if (this.day < this.dates.length) {
        if (!this.paused) {
          this.day++;
          setTimeout(this.increment, 200);
        }
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
      let baseUrl = 'https://aatishb.com/covidtrends/?';

      let queryUrl = new URLSearchParams();

      if (this.selectedScale == 'Linear Scale') {
        queryUrl.append('scale', 'linear');
      }

      if (this.selectedData == 'Reported Deaths') {
        queryUrl.append('data', 'deaths');
      }

      for (let country of this.countries) {
        if (this.selectedCountries.includes(country)) {
        queryUrl.append('country', country);
        }
      }

      let url = baseUrl + queryUrl.toString();

      window.history.replaceState( {} , 'Covid Trends', '?'+queryUrl.toString() );

      this.copyToClipboard(url);
      //alert('Here\'s a custom URL to pull up this view:\n' + url);


    },

    // code to copy a string to the clipboard
    // from https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
    copyToClipboard(str) {
      const el = document.createElement('textarea');  // Create a <textarea> element
      el.value = str;                                 // Set its value to the string that you want copied
      el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
      el.style.position = 'absolute';
      el.style.left = '-9999px';                      // Move outside the screen to make it invisible
      document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
      const selected =
        document.getSelection().rangeCount > 0        // Check if there is any content selected previously
          ? document.getSelection().getRangeAt(0)     // Store selection if found
          : false;                                    // Mark as false to know no selection existed before
      el.select();                                    // Select the <textarea> content
      document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
      document.body.removeChild(el);                  // Remove the <textarea> element
      if (selected) {                                 // If a selection existed before copying
        document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
        document.getSelection().addRange(selected);   // Restore the original selection
      }

      this.copied = true;
      setTimeout(() => this.copied = false, 2500);
    }

  },

  computed: {

    filteredCovidData() {
      return this.covidData.filter(e => this.selectedCountries.includes(e.country));
    },

    minDay() {
      let minDay = this.myMin(...this.filteredCovidData.map(e => e.slope.findIndex(f => f > 0)));
      if (isFinite(minDay) && !isNaN(minDay)){
        return minDay;
      } else {
        return -1;
      }
    }

  },

  data: {

    paused: true,

    dataTypes: ['Confirmed Cases', 'Reported Deaths'],

    selectedData: 'Confirmed Cases',

    sliderSelected: false,
	
	timeWindow: 3,

    day: 1,

    icon: 'icons/play.svg',

    scale: ['Logarithmic Scale', 'Linear Scale'],

    selectedScale: 'Logarithmic Scale',

    minCasesInCountry: 1,

    dates: [],

    covidData: [],

    countries: [],

    isHidden: true,

    selectedCountries: ['Australia', 'Canada', 'China', 'France', 'Germany', 'Iran', 'Italy', 'Japan', 'South Korea', 'Spain', 'Switzerland', 'US', 'United Kingdom', 'India', 'Pakistan'],

    graphMounted: false,

    autoplay: true,

    copied: false,
	
	perCapita: true,

  }

})
