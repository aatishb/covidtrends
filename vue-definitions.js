// custom graph component
Vue.component('graph', {

  props: ['graphData', 'day', 'resize'],

  template: '<div ref="graph" id="graph" style="height: 100%;"></div>',

  methods: {

    mountGraph() {

      Plotly.newPlot(this.$refs.graph, [], {}, {responsive: true});

      this.$refs.graph.on('plotly_hover', this.onHoverOn)
        .on('plotly_unhover', this.onHoverOff)
        .on('plotly_relayout', this.onLayoutChange);

    },

    onHoverOn(data) {

      let curveNumber = data.points[0].curveNumber;
      let name = this.graphData.traces[curveNumber].name;

      if (name) {

        this.traceIndices = this.graphData.traces.map((e,i) => e.name == name ? i : -1).filter(e => e >= 0);
        let update = {'line':{color: 'rgba(254, 52, 110, 1)'}};

        for (let i of this.traceIndices) {
          Plotly.restyle(this.$refs.graph, update, [i]);
        }
      }

    },

    onHoverOff() {

      let update = {'line':{color: 'rgba(0,0,0,0.15)'}};

      for (let i of this.traceIndices) {
        Plotly.restyle(this.$refs.graph, update, [i]);
      }

    },

    onLayoutChange(data) {

      this.emitGraphAttributes();

      // if the user selects autorange, go back to the default range
      if (data['xaxis.autorange'] == true || data['yaxis.autorange'] == true) {
        this.userSetRange = false;
        this.updateGraph();
      }

      // if the user selects a custom range, use this
      else if (data['xaxis.range[0]']) {
        this.xrange = [data['xaxis.range[0]'], data['xaxis.range[1]']].map(e => parseFloat(e));
        this.yrange = [data['yaxis.range[0]'], data['yaxis.range[1]']].map(e => parseFloat(e));
        this.userSetRange = true;
      }

    },

    updateGraph() {

      // we're deep copying the layout object to avoid side effects
      // because plotly mutates layout on user input
      // note: this may cause issues if we pass in date objects through the layout
      let layout = JSON.parse(JSON.stringify(this.graphData.layout));

      // if the user selects a custom range, use it
      if (this.userSetRange) {
        layout.xaxis.range = this.xrange;
        layout.yaxis.range = this.yrange;
      }

      Plotly.react(this.$refs.graph, this.graphData.traces, layout, this.graphData.config);

    },

    calculateAngle() {
      if (this.graphData.uistate.showTrendLine && this.graphData.uistate.doublingTime > 0) {
        let element = this.$refs.graph.querySelector('.cartesianlayer').querySelector('.plot').querySelector('.scatterlayer').lastChild.querySelector('.lines').firstChild.getAttribute('d');
        let pts = element.split('M').join(',').split('L').join(',').split(',').filter(e => e != '');
        let angle = Math.atan2(pts[3] - pts[1], pts[2] - pts[0]);
        return angle;
      } else {
        return NaN;
      }
    },

    emitGraphAttributes() {
      let graphOuterDiv = this.$refs.graph.querySelector('.main-svg').attributes;
      this.$emit('update:width', graphOuterDiv.width.nodeValue);
      this.$emit('update:height', graphOuterDiv.height.nodeValue);

      let graphInnerDiv = this.$refs.graph.querySelector('.xy').firstChild.attributes;
      this.$emit('update:innerWidth', graphInnerDiv.width.nodeValue);
      this.$emit('update:innerHeight', graphInnerDiv.height.nodeValue);
      this.$emit('update:referenceLineAngle', this.calculateAngle());
    }

  },

  mounted() {
    this.mountGraph();

    if (this.graphData) {
      this.updateGraph();
    }

    this.emitGraphAttributes();
    this.$emit('update:mounted', true);

  },

  watch: {

    graphData: {

      deep: true,

      handler(data, oldData) {

        // if UI state changes, revert to auto range
        if (JSON.stringify(data.uistate) != JSON.stringify(oldData.uistate)) {
          this.userSetRange = false;
        }

        this.updateGraph();
        this.$emit('update:referenceLineAngle', this.calculateAngle());

      }

    },

    resize() {
      Plotly.Plots.resize(this.$refs.graph);
    },


  },

  data() {
    return {
      xrange: [], // stores user selected xrange
      yrange: [], // stores user selected yrange
      userSetRange: false, // determines whether to use user selected range
      traceIndices: [],
    };
  }

});

// global data
window.app = new Vue({

  el: '#root',

  mounted() {
    this.pullData(this.selectedData, this.selectedRegion);
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

      if (urlParameters.has('region')) {
        let myRegion = urlParameters.get('region');
        if (this.regions.includes(myRegion)) {
          this.selectedRegion = myRegion;
        }
      }

      // since this rename came later, use the old name to not break existing URLs
      let renames = {
        'China': 'China (Mainland)'
      };

      // before we added regions, the url parameter was called country instead of location
      // we still check for this so as to not break existing URLs
      if (urlParameters.has('country')) {
        this.selectedCountries = urlParameters.getAll('country').map(e => Object.keys(renames).includes(e) ? renames[e] : e);
      } else if (urlParameters.has('location')) {
        this.selectedCountries = urlParameters.getAll('location').map(e => Object.keys(renames).includes(e) ? renames[e] : e);
      }

      if (urlParameters.has('trendline')) {
        let showTrendLine = urlParameters.get('trendline');
        this.showTrendLine = (showTrendLine == 'true');
      } else if (urlParameters.has('doublingtime')) {
        let doublingTime = urlParameters.get('doublingtime');
        this.doublingTime = doublingTime;
      }


    }

    window.addEventListener('keydown', e => {

      if ((e.key == ' ') && this.dates.length > 0) {
        this.play();
      }

      else if ((e.key == '-' || e.key == '_') && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.max(this.day - 1, this.minDay);
      }

      else if ((e.key  == '+' || e.key == '=') && this.dates.length > 0) {
        this.paused = true;
        this.day = Math.min(this.day + 1, this.dates.length);
      }

    });

  },


  watch: {
    selectedData() {
      if (!this.firstLoad) {
        this.pullData(this.selectedData, this.selectedRegion, /*updateSelectedCountries*/ false);
      }
      this.searchField = '';
    },

    selectedRegion() {
      if (!this.firstLoad) {
        this.pullData(this.selectedData, this.selectedRegion, /*updateSelectedCountries*/ true);
      }
      this.searchField = '';
    },

    minDay() {
      if (this.day < this.minDay) {
        this.day = this.minDay;
      }
    },

    'graphAttributes.mounted': function() {

      if (this.graphAttributes.mounted && this.autoplay && this.minDay > 0) {
        this.day = this.minDay;
        this.play();
        this.autoplay = false; // disable autoplay on first play
      }
    },

    searchField() {
      let debouncedSearch = this.debounce(this.search, 250, false);
      debouncedSearch();
    }
  },

  methods: {

    debounce(func, wait, immediate) { // https://davidwalsh.name/javascript-debounce-function
      var timeout;
      return function() {
        var context = this, args = arguments;
        var later = function() {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
      };
    },

    myMax() { // https://stackoverflow.com/a/12957522
      var par = [];
      for (var i = 0; i < arguments.length; i++) {
        if (!isNaN(arguments[i])) {
          par.push(arguments[i]);
        }
      }
      return Math.max.apply(Math, par);
    },

    myMin() {
      var par = [];
      for (var i = 0; i < arguments.length; i++) {
        if (!isNaN(arguments[i])) {
          par.push(arguments[i]);
        }
      }
      return Math.min.apply(Math, par);
    },

    pullData(selectedData, selectedRegion, updateSelectedCountries = true) {

      if (selectedRegion != 'US') {
        let url;
        if (selectedData == 'Confirmed Cases') {
          url = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv';
        } else if (selectedData == 'Reported Deaths') {
          url = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv';
        } else {
          return;
        }
        Plotly.d3.csv(url, (data) => this.processData(data, selectedRegion, updateSelectedCountries));
      } else { // selectedRegion == 'US'
        const type = (selectedData == 'Reported Deaths') ? 'deaths' : 'cases';
        const url = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv';
        Plotly.d3.csv(url, (data) => this.processData(this.preprocessNYTData(data, type), selectedRegion, updateSelectedCountries));
      }
    },

    removeRepeats(array) {
      return [...new Set(array)];
    },

    groupByCountry(data, dates, regionsToPullToCountryLevel /* pulls out Hong Kong & Macau from region to country level */) {

      let countries = data.map(e => e['Country/Region']);
      countries = this.removeRepeats(countries);

      let grouped = [];
      for (let country of countries){

        // filter data for this country (& exclude regions we're pulling to country level)
        // e.g. Mainland China numbers should not include Hong Kong & Macau, to avoid double counting
        let countryData = data.filter(e => e['Country/Region'] == country)
          .filter(e => !regionsToPullToCountryLevel.includes(e['Province/State']));

        const row = {region: country};

        for (let date of dates) {
          let sum = countryData.map(e => parseInt(e[date]) || 0).reduce((a,b) => a+b);
          row[date] = sum;
        }

        grouped.push(row);

      }

      return grouped;
    },

    filterByCountry(data, dates, selectedRegion) {
      return data.filter(e => e['Country/Region'] == selectedRegion)
        .map(e => Object.assign({}, e, {region: e['Province/State']}));
    },

    convertStateToCountry(data, dates, selectedRegion) {
      return data.filter(e => e['Province/State'] == selectedRegion)
        .map(e => Object.assign({}, e, {region: e['Province/State']}));
    },

    processData(data, selectedRegion, updateSelectedCountries) {
      let dates = Object.keys(data[0]).slice(4);
      this.dates = dates;
      this.day = this.dates.length;

      let regionsToPullToCountryLevel = ['Hong Kong', 'Macau'];

      let grouped;

      if (selectedRegion == 'World') {
        grouped = this.groupByCountry(data, dates, regionsToPullToCountryLevel);

        // pull Hong Kong and Macau to Country level
        for (let region of regionsToPullToCountryLevel) {
          let country = this.convertStateToCountry(data, dates, region);
          if (country.length === 1) {
            grouped = grouped.concat(country);
          }
        }

      } else {
        grouped = this.filterByCountry(data, dates, selectedRegion)
          .filter(e => !regionsToPullToCountryLevel.includes(e.region)); // also filter our Hong Kong and Macau as subregions of Mainland China
      }

      let exclusions = ['Cruise Ship', 'Diamond Princess'];

      let renames = {
        'Taiwan*': 'Taiwan',
        'Korea, South': 'South Korea',
        'China': 'China (Mainland)'
      };

      let covidData = [];
      for (let row of grouped){

        if (!exclusions.includes(row.region)) {
          const arr = [];
          for (let date of dates) {
            arr.push(row[date]);
          }
          let slope = arr.map((e,i,a) => e - a[i - this.lookbackTime]);
          let region = row.region;

          if (Object.keys(renames).includes(region)) {
            region = renames[region];
          }

          const cases = arr.map(e => e >= this.minCasesInCountry ? e : NaN);
          covidData.push({
            country: region,
            cases,
            slope: slope.map((e,i) => arr[i] >= this.minCasesInCountry ? e : NaN),
            maxCases: this.myMax(...cases)
          });

        }
      }

      this.covidData = covidData.filter(e => e.maxCases > this.minCasesInCountry);
      this.countries = this.covidData.map(e => e.country).sort();
      this.visibleCountries = this.countries;
      const topCountries = this.covidData.sort((a, b) => b.maxCases - a.maxCases).slice(0, 9).map(e => e.country);
      const notableCountries = ['China (Mainland)', 'India', 'US', // Top 3 by population
        'South Korea', 'Japan', 'Taiwan', 'Singapore', // Observed success so far
        'Hong Kong',            // Was previously included in China's numbers
        'Canada', 'Australia']; // These appear in the region selector

      // TODO: clean this logic up later
      // expected behavior: generate/overwrite selected locations if: 1. data loaded from URL, but no selected locations are loaded. 2. data refreshed (e.g. changing region)
      // but do not overwrite selected locations if 1. selected locations loaded from URL. 2. We switch between confirmed cases <-> deaths
      if ((this.selectedCountries.length === 0 || !this.firstLoad) && updateSelectedCountries) {
        this.selectedCountries = this.countries.filter(e => topCountries.includes(e) || notableCountries.includes(e));
      }

      this.firstLoad = false;
    },

    preprocessNYTData(data, type) {
      let recastData = {};
      data.forEach(e => {
        let st = recastData[e.state]  = (recastData[e.state] || {'Province/State': e.state, 'Country/Region': 'US', 'Lat': null, 'Long': null});
        st[fixNYTDate(e.date)] = parseInt(e[type]);
      });
      return Object.values(recastData);

      function fixNYTDate(date) {
        let tmp = date.split('-');
        return `${tmp[1]}/${tmp[2]}/${tmp[0].substr(2)}`;
      }
    },

    formatDate(date) {
      if (!date) {
        return '';
      }

      let [m, d, y] = date.split('/');
      return new Date(Date.UTC(2000 + (+y), m-1, d)).toISOString().slice(0, 10);
    },

    dateToText(date) {
      if (!date) {
        return '';
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      let [m, d] = date.split('/');
      return monthNames[m-1] + ' ' + d;
    },

    // TODO: clean up play/pause logic
    play() {
      if (this.paused) {

        if (this.day == this.dates.length) {
          this.day = this.minDay;
        }

        this.paused = false;
        setTimeout(this.increment, 200);

      } else {
        this.paused = true;
      }

    },

    pause() {
      if(! this.paused) {
        this.paused = true;
      }
    },

    increment() {

      if (this.day == this.dates.length || this.minDay < 0) {
        this.day = this.dates.length;
        this.paused = true;
      }
      else if (this.day < this.dates.length) {
        if (!this.paused) {
          this.day++;
          setTimeout(this.increment, 200);
        }
      }

    },

    search() {
      this.visibleCountries = this.countries.filter(e => e.toLowerCase().includes(this.searchField.toLowerCase()));
    },

    selectAll() {
      this.selectedCountries = this.countries;
    },

    deselectAll() {
      this.selectedCountries = [];
    },

    toggleHide() {
      this.isHidden = !this.isHidden;
    },

    createURL() {

      let baseUrl = window.location.href.split('?')[0];

      let queryUrl = new URLSearchParams();

      if (this.selectedScale == 'Linear Scale') {
        queryUrl.append('scale', 'linear');
      }

      if (this.selectedData == 'Reported Deaths') {
        queryUrl.append('data', 'deaths');
      }

      if (this.selectedRegion != 'World') {
        queryUrl.append('region', this.selectedRegion);
      }

      // since this rename came later, use the old name for URLs to avoid breaking existing URLs
      let renames = {
        'China (Mainland)': 'China'
      };

      for (let country of this.countries) {
        if (this.selectedCountries.includes(country)) {
          if(Object.keys(renames).includes(country)) {
            queryUrl.append('location', renames[country]);
          } else {
            queryUrl.append('location', country);
          }
        }
      }

      if (!this.showTrendLine) {
        queryUrl.append('trendline', this.showTrendLine);
      } else if (this.doublingTime != 2) {
        queryUrl.append('doublingtime', this.doublingTime);
      }

      let url = baseUrl + '?' + queryUrl.toString();

      window.history.replaceState( {} , 'Covid Trends', '?'+queryUrl.toString() );

      this.copyToClipboard(url);

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
    },

    // reference line for exponential growth with a given doubling time
    referenceLine(x) {
      return x * (1 - Math.pow(2, -this.lookbackTime / this.doublingTime));
    }

  },

  computed: {

    filteredCovidData() {
      return this.covidData.filter(e => this.selectedCountries.includes(e.country));
    },

    minDay() {
      let minDay = this.myMin(...(this.filteredCovidData.map(e => e.slope.findIndex(f => f > 0)).filter(x => x != -1)));
      if (isFinite(minDay) && !isNaN(minDay)){
        return minDay + 1;
      } else {
        return -1;
      }
    },

    regionType() {
      switch (this.selectedRegion) {
        case 'World':
          return 'Countries';
        case 'Australia':
        case 'US':
          return 'States / Territories';
        case 'China':
          return 'Provinces';
        case 'Canada':
          return 'Provinces';
        default:
          return 'Regions';
      }
    },

    annotations() {

      return [{
        visible: this.showTrendLine && this.doublingTime > 0,
        x: this.xAnnotation,
        y: this.yAnnotation,
        xref: 'x',
        yref: 'y',
        xshift: -50 * Math.cos(this.graphAttributes.referenceLineAngle),
        yshift: 50 * Math.sin(this.graphAttributes.referenceLineAngle),
        text: this.doublingTime + ' Day Doubling Time<br>of ' + this.selectedData,
        align: 'right',
        showarrow: false,
        textangle: this.graphAttributes.referenceLineAngle * 180 / Math.PI,
        font: {
          family: 'Open Sans, sans-serif',
          color: 'black',
          size: 14
        },
      }];


    },

    layout() {
      return {
        title: 'Trajectory of ' + this.selectedRegion + ' COVID-19 '+ this.selectedData + ' (' + this.formatDate(this.dates[this.day - 1]) + ')',
        showlegend: false,
        autorange: false,
        xaxis: {
          title: 'Total ' + this.selectedData,
          type: this.selectedScale == 'Logarithmic Scale' ? 'log' : 'linear',
          range: this.selectedScale == 'Logarithmic Scale' ? this.logxrange : this.linearxrange,
          titlefont: {
            size: 24,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        yaxis: {
          title: 'New ' + this.selectedData + ' (in the Past Week)',
          type: this.selectedScale == 'Logarithmic Scale' ? 'log' : 'linear',
          range: this.selectedScale == 'Logarithmic Scale' ? this.logyrange : this.linearyrange,
          titlefont: {
            size: 24,
            color: 'rgba(254, 52, 110,1)'
          },
        },
        hovermode: 'closest',
        font: {
          family: 'Open Sans, sans-serif',
          color: 'black',
          size: 14
        },
        annotations: this.annotations
      };
    },

    traces() {

      let showDailyMarkers = this.filteredCovidData.length <= 2;

      // draws grey lines (line plot for each location)
      let trace1 = this.filteredCovidData.map((e,i) => ({
        x: e.cases.slice(0, this.day),
        y: e.slope.slice(0, this.day),
        name: e.country,
        text: this.dates.map(date => e.country + '<br>' + this.formatDate(date) ),
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

      // draws red dots (most recent data for each location)
      let trace2 = this.filteredCovidData.map((e,i) => ({
        x: [e.cases[this.day - 1]],
        y: [e.slope[this.day - 1]],
        text: e.country,
        name: e.country,
        mode: this.showLabels ? 'markers+text' : 'markers',
        legendgroup: i,
        textposition: 'center right',
        marker: {
          size: 6,
          color: 'rgba(254, 52, 110, 1)'
        },
        hovertemplate: '%{data.text}<br>Total ' + this.selectedData +': %{x:,}<br>Weekly ' + this.selectedData +': %{y:,}<extra></extra>',

      }));

      if (this.showTrendLine && this.doublingTime > 0) {
        let cases = [1, 10000000];

        let trace3 = [{
          x: cases,
          y: cases.map(this.referenceLine),
          mode: 'lines',
          line: {
            dash: 'dot',
          },
          marker: {
            color: 'rgba(114, 27, 101, 0.7)'
          },
          hoverinfo: 'skip',
        }];

        // reference line must be last trace for annotation angle to work out
        return [...trace1, ...trace2, ...trace3];

      } else {
        return [...trace1, ...trace2];
      }


    },

    config() {
      return {
        responsive: true,
        toImageButtonOptions: {
          format: 'png', // one of png, svg, jpeg, webp
          filename: 'Covid Trends',
          height: 600,
          width: 600 * this.graphAttributes.width / this.graphAttributes.height,
          scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
        }
      };
    },

    graphData() {
      return {
        uistate: { // graph is updated when uistate changes
          selectedData: this.selectedData,
          selectedRegion: this.selectedRegion,
          selectedScale: this.selectedScale,
          showLabels: this.showLabels,
          showTrendLine: this.showTrendLine,
          doublingTime: this.doublingTime,
        },
        traces: this.traces,
        layout: this.layout,
        config: this.config
      };
    },

    xmax() {
      return Math.max(...this.filteredCases, 50);
    },

    xmin() {
      return Math.min(...this.filteredCases, 50);
    },

    ymax() {
      return Math.max(...this.filteredSlope, 50);
    },

    ymin() {
      return Math.min(...this.filteredSlope);
    },

    filteredCases() {
      return Array.prototype.concat(...this.filteredCovidData.map(e => e.cases)).filter(e => !isNaN(e));
    },

    filteredSlope() {
      return Array.prototype.concat(...this.filteredCovidData.map(e => e.slope)).filter(e => !isNaN(e));
    },

    logxrange() {
      return [1, Math.ceil(Math.log10(1.5 * this.xmax))];
    },

    linearxrange() {
      return [-0.49*Math.pow(10,Math.floor(Math.log10(this.xmax))), Math.round(1.2 * this.xmax)];
    },

    logyrange() {

      if (this.ymin < 10) { // shift ymin on log scale if fewer than 10 cases
        return [0, Math.ceil(Math.log10(1.5 * this.ymax))];
      } else {
        return [1, Math.ceil(Math.log10(1.5 * this.ymax))];
      }
    },

    linearyrange() {
      let ymax = Math.max(...this.filteredSlope, 50);
      return [-Math.pow(10,Math.floor(Math.log10(ymax))-2), Math.round(1.05 * ymax)];
    },

    xAnnotation() {

      if (this.selectedScale == 'Logarithmic Scale') {
        let x = this.logyrange[1] - Math.log10(this.referenceLine(1));
        if (x < this.logxrange[1]) {
          return x;
        } else {
          return this.logxrange[1];
        }

      } else {
        let x = this.linearyrange[1] / this.referenceLine(1);
        if (x < this.linearxrange[1]) {
          return x;
        } else {
          return this.linearxrange[1];
        }
      }
    },

    yAnnotation() {
      if (this.selectedScale == 'Logarithmic Scale') {
        let x = this.logyrange[1] - Math.log10(this.referenceLine(1));
        if (x < this.logxrange[1]) {
          return this.logyrange[1];
        } else {
          return this.logxrange[1] + Math.log10(this.referenceLine(1));
        }
      } else {
        let x = this.linearyrange[1] / this.referenceLine(1);
        if (x < this.linearxrange[1]) {
          return this.linearyrange[1];
        } else {
          return this.linearxrange[1] * this.referenceLine(1);
        }
      }

    }

  },

  data: {

    paused: true,

    dataTypes: ['Confirmed Cases', 'Reported Deaths'],

    selectedData: 'Confirmed Cases',

    regions: ['World', 'US', 'China', 'Australia', 'Canada'],

    selectedRegion: 'World',

    sliderSelected: false,

    day: 7,

    lookbackTime: 7,

    scale: ['Logarithmic Scale', 'Linear Scale'],

    selectedScale: 'Logarithmic Scale',

    minCasesInCountry: 50,

    dates: [],

    covidData: [],

    countries: [],

    visibleCountries: [],

    isHidden: true,

    showLabels: true,

    showTrendLine: true,

    doublingTime: 2,

    selectedCountries: [],

    searchField: '',

    autoplay: true,

    copied: false,

    firstLoad: true,

    graphAttributes: {
      mounted: false,
      innerWidth: NaN,
      innerHeight: NaN,
      width: NaN,
      height: NaN,
      referenceLineAngle: NaN
    },

  }

});
