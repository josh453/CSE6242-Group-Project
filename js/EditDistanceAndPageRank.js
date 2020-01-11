import PageRank from "./pageRankClass.js";

// Page Rank Implementation
const rankQuestions = function(dataArray, alpha = 0.85, epsilon = 0.000001) {
  const graphToRank = new PageRank();

  for (let record of dataArray) {
    graphToRank.link(
      record["source"],
      record["target"],
      parseFloat(record["value"])
    );
  }
  let rankedQuestions = [];

  graphToRank.rank(alpha, epsilon, (node, rank) => {
    rankedQuestions.push({ node: parseInt(node), rank });
  });

  rankedQuestions = rankedQuestions.sort((a, b) => (a.rank > b.rank ? -1 : 1));
  let rankedQuestionsInts = rankedQuestions.map((x, index) => {
    return {
      node: x.node,
      index: index + 1
    };
  });

  let rankedQuestionsObject = rankedQuestionsInts.reduce(
    (obj, item) => Object.assign(obj, { [item.node]: item.index }),
    {}
  );

  return rankedQuestionsObject;
};

window.rankQuestions = rankQuestions;
//Edit Distance Implementation

const levenshteinDistance = function(a, b) {
  // Generously adapted from https://gist.github.com/andrei-m/982927

  if (a.length == 0) return b.length;
  if (b.length == 0) return a.length;

  let matrix = [];

  // increment along the first column of each row
  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1
          )
        ); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
};

const normalizeQuestionTitle = function(questionTitle) {
  const normalizedQuestionTitle = questionTitle
    .trim()
    .toLowerCase()
    .replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()@\+\?><\[\]\+]/g, "");

  return normalizedQuestionTitle;
};

const kCombinations = (set, k) => {
  if (k > set.length || k <= 0) {
    return [];
  }

  if (k == set.length) {
    return [set];
  }

  if (k == 1) {
    return set.reduce((acc, cur) => [...acc, [cur]], []);
  }

  let combs = [],
    tail_combs = [];

  for (let i = 0; i <= set.length - k + 1; i++) {
    tail_combs = kCombinations(set.slice(i + 1), k - 1);
    for (let j = 0; j < tail_combs.length; j++) {
      combs.push([set[i], ...tail_combs[j]]);
    }
  }

  return combs;
};

const calculatePairSimilarity = function(qOne, qTwo) {
  let normalizedTitleOne = normalizeQuestionTitle(qOne["title"]);
  let normalizedTitleTwo = normalizeQuestionTitle(qTwo["title"]);

  let levenshteinDistanceCalculation = levenshteinDistance(
    normalizedTitleOne,
    normalizedTitleTwo
  );

  // calculate how similar the question titles are
  let titleSimilarityIndex =
    1 -
    levenshteinDistanceCalculation /
      Math.max(normalizedTitleOne.length, normalizedTitleTwo.length);

  return (titleSimilarityIndex).toFixed(4);

};

//global window function
window.calculatePairSimilarity = calculatePairSimilarity;
