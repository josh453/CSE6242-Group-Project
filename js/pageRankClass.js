// Generously adapted from https://github.com/alixaxel/pagerank.js/
export default class PageRank {
  constructor() {
    this.count = 0;
    this.edges = {};
    this.nodes = {};
  }

  forIn(object, callback) {
    if (typeof object === "object" && typeof callback === "function") {
      for (var key in object) {
        if (callback(key, object[key]) === false) {
          break;
        }
      }
    }
  }

  forOwn(object, callback) {
    this.forIn(object, (key, value) => {
      if (object.hasOwnProperty(key) === true) {
        callback(key, value);
      }
    });
  }

  link(source, target, weight) {
    if (isFinite(weight) !== true || weight === null) {
      weight = 1;
    }

    weight = parseFloat(weight);

    if (this.nodes.hasOwnProperty(source) !== true) {
      this.count++;
      this.nodes[source] = {
        weight: 0,
        outbound: 0
      };
    }

    this.nodes[source].outbound += weight;

    if (this.nodes.hasOwnProperty(target) !== true) {
      this.count++;
      this.nodes[target] = {
        weight: 0,
        outbound: 0
      };
    }

    if (this.edges.hasOwnProperty(source) !== true) {
      this.edges[source] = {};
    }

    if (this.edges[source].hasOwnProperty(target) !== true) {
      this.edges[source][target] = 0;
    }

    this.edges[source][target] += weight;
  }

  rank(alpha, epsilon, callback) {
    var delta = 1,
      inverse = 1 / this.count;

    this.forOwn(this.edges, source => {
      if (this.nodes[source].outbound > 0) {
        this.forOwn(this.edges[source], target => {
          this.edges[source][target] /= this.nodes[source].outbound;
        });
      }
    });

    this.forOwn(this.nodes, key => {
      this.nodes[key].weight = inverse;
    });

    while (delta > epsilon) {
      var leak = 0,
        nodes = {};

      this.forOwn(this.nodes, (key, value) => {
        nodes[key] = value.weight;

        if (value.outbound === 0) {
          leak += value.weight;
        }

        this.nodes[key].weight = 0;
      });

      leak *= alpha;

      this.forOwn(this.nodes, source => {
        this.forOwn(this.edges[source], (target, weight) => {
          this.nodes[target].weight += alpha * nodes[source] * weight;
        });

        this.nodes[source].weight += (1 - alpha) * inverse + leak * inverse;
      });

      delta = 0;

      this.forOwn(this.nodes, (key, value) => {
        delta += Math.abs(value.weight - nodes[key]);
      });
    }

    this.forOwn(this.nodes, key => {
      callback(key, this.nodes[key].weight);
    });
  }

  reset() {
    this.count = 0;
    this.edges = {};
    this.nodes = {};
  }
}
