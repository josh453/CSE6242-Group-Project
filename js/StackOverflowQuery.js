//This script adapted from https://p.migdal.pl/tagoverflow/se_query.js
var dbMaxSize = 4096
var previousQuery = ""
var topNMatchingQuestionLimit = 5;      //How many of the top matching questions to keep?
var topMLinkedQuestionLimit = 10;        //Limit to this many linked questions per matching question
var questions = []                      //List of current matching questions
var previousQueries = new Set()         //Keep track of all queries to prevent duplicates
var allQueryResults = new Object()      //Maps a unqiue query to list of matching question IDs
var allIDs = new Set()                  //Holds all IDs of questions to be displayed (both matching and linked Qs)
var questionsDB = new Map()             //Map question IDs to question data  
var answersDB = new Map()               //Ditto for answers
var promises = []                       //Stores current async API calls (promises)
var currentLinkedQuestions  = []        //Temp placeholder for Linked Qs for the current question
var currentLinkedIDS = []               //Temp container for Linked IDs for the current question
var currentEntry = {}                   //Temp container for a question
var currentEdgeList = []                //Stores the edge list relevant to the current query
var currentEdgeListofDicts = []         //Stores the edge list in the same format as HW2 
var levelOneIds = new Set()             //Holds the IDs of the selected question (if applicable) and the topMLinkedQuestions
var uniqueEdges = new Set()
var minEdgeWeight = 1000;
var maxEdgeWeight = -1000;
var style = "position: fixed; left: 0; bottom: 0; z-index: 1000000;";
var countAPICalls = 0;
var queriesRemaining = 10000;
var edge_data = []

//var nodes = {};

//Variables for the API calls
var apiName = "https://api.stackexchange.com/2.2/";
var apiKey = "iiOd1nXhCCQpqnvJybB5cg((";
var timeOfLastAPICall = 0;
var apiWaitTime = 34;   //StackOverflow limits calls to 30/second with api key.  So wait this many milliseconds between calls
var backOff = 0;
var linkedQuestions = new Map();

function init() {
    SearchForQuestions(document.getElementById("searchbar"), questions);
}

function buildEdgeList(append_mode){
    d3.select("#status").text("System Status: Now build the edgeList...")
    //Create a temp array of all questions IDs in the database
    let allTempIDs = Array.from( questionsDB.keys())
    //And another array of the question IDs to be displayed
    let allIDsArray = Array.from(allIDs)
    //Iterate over all Qs to be displayed, looking for linked questions to each
    for(var i = 0; i < allIDsArray.length; i++){
        //If it has some linked questions
        if(questionsDB.get(allIDsArray[i]).hasOwnProperty("linked_questions")){
            //Get the array of linked question IDs
            let thisQuestion = questionsDB.get(allIDsArray[i])
            //But only those IDs whose questions are in our database
            let linkedQuestionIDs = thisQuestion.linked_questions.filter(x => allTempIDs.includes(x))
            d3.select("#status").text("System Status: Get questions linked from question "+thisQuestion.question_id)
            //For each linked Q in the database, add an entry to the currentEdgeList
            for(var k = 0; k < linkedQuestionIDs.length; k++){
                uniqueEdge = [linkedQuestionIDs[k],thisQuestion.question_id].join(",")
                d3.select("#status").text("System Status: Saving unique edge" + uniqueEdge)
                if(!uniqueEdges.has(uniqueEdge)){
                  uniqueEdges.add(uniqueEdge)
                  allIDs.add(linkedQuestionIDs[k])
                  let thatQuestion = questionsDB.get(linkedQuestionIDs[k])
                  let simResult = calculatePairSimilarity(thisQuestion, thatQuestion)
                  //Update min and max edge weights
                  minEdgeWeight = Math.min(simResult, minEdgeWeight)
                  maxEdgeWeight = Math.max(simResult, maxEdgeWeight)
                  currentEdgeList.push([thisQuestion.question_id, linkedQuestionIDs[k],simResult])
                  currentEdgeListofDicts.push({"source":thisQuestion.question_id, "target":linkedQuestionIDs[k],"value":simResult})
              }
            }
        }
    }   
    //Now build the graph
    for(var i = 0; i < currentEdgeList.length; i++){
      edge_data.push({'source':currentEdgeList[i][0].toString(), 'target':currentEdgeList[i][1].toString(), 'weight':parseFloat(currentEdgeList[i][2])})
    }
    if(allIDs.size == 0){
      d3.select("#status").text("System Status: No questions found that match that query.")
    } 
    else{
       BuildGraph(append_mode);    
       d3.select("#status").text("System Status: Done building graph.")
    }
}

//The function below deletes all in-memory data structs to prevent the application from
//Taking too much memory
function resetDataStructs(){
    d3.select("#status").text("System Status: Resetting data structs...")
    d3.select("#status").text = "Resetting data structs..."
    prevText = ""
    previousQueries = new Set()     //Keep track of all queries to prevent duplicates
    questionsDB = new Map()         //Map question IDs to question data
    answersDB = new Map()           //Ditto for answers
    currentLinkedQuestions  = []
    promises = []
    linkedIDs = []
    currentEdgeList = []
    currentEdgeListofDicts = []    
    allIDs.clear()
    d3.select("#status").text("System Status: Done.")
    previousQuery = ""
    uniqueEdges = new Set()
    levelOneIds = new Set()
    minEdgeWeight = 1000;
    maxEdgeWeight = -1000;
    edge_data = []

}


async function SearchForQuestions(queryString) {
  d3.select("#status").text("System Status: Entered SearchForQuestions with query_string:" + queryString)

    var vals = queryString.toString().replace("#", "%23");  // C# problem
    vals = vals.replace("-", " ");                          //Replace dashes with spaces
    vals = vals.toLowerCase().match(/\S+/g) || []           //Convert to lowercase and strip whitespace
    
    /*Don't call this function if:
    There are fewer than 2 distinct search terms, fewer than 10 characters,
    or the term has already been queried (i.e. that search term is still cached in previousQueries)
    */
    if(vals.length <= 2 ||  queryString.length < 10){
      d3.select("#status").text("System Status: Awaiting query with at least 3 words and 10 characters.")
      return
    };

    var uniqueQueryString = vals.sort().join("_")

    d3.select("#status").text("System Status: Unique Query String: "+uniqueQueryString)
    if(uniqueQueryString == previousQuery){
        d3.select("#status").text("System Status: Semantically identical query as the previous one. Nothing to do.")
        return
    }
    previousQuery = uniqueQueryString

    vals = new Set(vals)

    //Free memory if DB has grown past the limit
    if(questionsDB.size > dbMaxSize) {
        resetDataStructs()
    }
    //Reset these variables regardless
    else{
        d3.select("#status").text("System Status: Basic reset.")
        promises = []
        currentLinkedQuestions = []
        currentEdgeList = []
        currentEdgeListofDicts = []
        questions = []
        allIDs.clear()
        uniqueEdges = new Set()
        levelOneIds = new Set()
        minEdgeWeight = 1000;
        maxEdgeWeight = -1000;
        edge_data = []


    }
    queryRequired = true //Initially, we assume the query has not been used before        
    //Check our assumption: has the query been used before?
    if( previousQueries.has(uniqueQueryString) ){
        d3.select("#status").text("System Status: Already queried Stack Overflow for these terms:" + vals.toString() + "attempt to rebuild questions list from cache.");        
        //Get the questions from the database, if they exist.
        for(var i = 0; i < allQueryResults[uniqueQueryString].length; i++){
            if(questionsDB.has(allQueryResults[uniqueQueryString][i])) questions.push(questionsDB.get(allQueryResults[uniqueQueryString][i]))
            //If even a single question isn't present, (perhaps due to flushing the cache to save memory)
            //just issue the query to StackOverflow, as it will get the top N question in single query
            else{
                break
            }
        }
        //If we've reached this point, we have all the questions we need, so no initial query is required. :)
        queryRequired = false
    }
    if (queryRequired){
        d3.select("#status").text("System Status: Calling Stack Overflow API for questions matching: " + uniqueQueryString)
        //Section for collecting relevant questions on SO
        //Get the top 5 questions returned by searching with these terms
        previousQueries.add(uniqueQueryString)
        countAPICalls++;
        questions = seAdvancedQuestionSearch(vals,topNMatchingQuestionLimit)
        d3.select("#status").text("System Status: Retrieved "+questions.length+" matching questions.")

    }
    //At this point, questions contains the top N matching questions, 
    //either extracted from the cached data, or retrieved via the API.
    temp_ids = []
    //Iterate over the results, adding appropriate data to various data structs
    for(var i = 0; i < questions.length; i++){
        //First, add the ID of each question to a temp list
        temp_ids.push(questions[i].question_id)
        //Also to the allIDs array
        allIDs.add(questions[i].question_id);
        //Next, add each question to the question "database" - which is just an in-memory JS object
        //If it is not already in the "database"
        if(!(questionsDB.has(questions[i].question_id))){
            //Next, get the linked questions for this question
            countAPICalls++;
            //In the line below, the 0 will be replaced by 30 in the called function
            let linkedPromise = getTopLinkedQuestions(questions[i].question_id, 0)
            promises.push(linkedPromise)
        
            //While waiting for the promises above to resolve (i.e. info about linked questions to come in) 
            //add each question to the question "database" - which is just an in-memory JS object
            questionsDB.set(questions[i].question_id,
            {
                accepted_answer_id: questions[i].accepted_answer_id || -1,
                answer_count: questions[i].answer_count,
                creation_date: questions[i].creation_date,
                is_answered: questions[i].is_answered,
                last_activity_date: questions[i].last_activity_date,
                last_edit_date: questions[i].last_edit_date,
                link: questions[i].link,
                owner: questions[i].owner,
                question_id: questions[i].question_id,
                score: questions[i].score,
                tags: questions[i].tags,
                title: questions[i].title.replace(/&quot;/g, "'").replace(/&#39;/g,"'").replace(/&lt;/g,"<"),

                //Will also add the list of linked question IDs once they come in
            })
        }//Only for questions that don't already exist in our in-memory 'database'
    }//for each of the top matching questions

    //Add the list of returned answer IDs to the list of query results
    //This lists maps unique query strings to a list of question IDs returned
    allQueryResults[uniqueQueryString] = temp_ids
    levelOneIds = new Set(temp_ids)
    
    //Mostly done processing all the initial questions.  At this point the info 
    //about the linked questions is ready.
    //First, we handle the case that all the info was already cached.  
    //In this case, we simply need to rebuild the allIDs
    if(promises.length == 0){
        //d3.select("#status").text("System Status: Empty promises!")
        d3.select("#status").text("System Status: Retrieving data from cache.")
        //For each matching question
        for(var i = 0; i < questions.length; i++){
            if(!questions[i].hasOwnProperty("linked_questions")) {continue;}
            //For each (top M) question linked to a matching question
            for(var j = 0; j < Math.min(questions[i]["linked_questions"].length, topMLinkedQuestionLimit); j++){
                //Add an edge from the matching question to the linked question
                //Add the ID of the linked question to the list of all relevent question IDs
                allIDs.add(questions[i].linked_questions[j])
            }
        }
        buildEdgeList(false)
    }

    else{
        //Else, we had to query the API and populate the questionsDB 
        Promise.all(promises).then(function(result){
            //Because promises returns ALL promises, only take the M most recent ones resolved
            currentLinkedQuestions = result.slice(result.length-topMLinkedQuestionLimit, result.length)

            //For each of the questions returned from the search query...
            for(var i = 0; i < currentLinkedQuestions.length; i++){
                linkedIDs = []
                //Push the id of ALL of the linked questions into a temp array of IDs
                //This will be stored in the question object in the questionsDB
                for(var j = 0; j < currentLinkedQuestions[i].length; j++) linkedIDs.push(currentLinkedQuestions[i][j].question_id);

                //But we'll only display the top M linked questions
                currentLinkedQuestions[i] = currentLinkedQuestions[i].slice(0, Math.min(topMLinkedQuestionLimit, currentLinkedQuestions[i].length))
                //For each linked question...
                for(var j = 0; j < currentLinkedQuestions[i].length; j++){
                    //Push the ID to allIDs
                    allIDs.add(currentLinkedQuestions[i][j].question_id)
                    //Get the questions linked to this question - this is a synchronous call
                    secondLevelcurrentLinkedQuestions = synchronousGetTopLinkedQuestions(currentLinkedQuestions[i][j].question_id, 30)
                    secondLevelLinkedIDs = []
                    for(var k = 0; k < secondLevelcurrentLinkedQuestions.length; k++){
                        secondLevelLinkedIDs.push(secondLevelcurrentLinkedQuestions[k].question_id)
                    }                    
                    //Add an entry to the currentEdgeList data struct: edge from matching question to linked question
                    //...add it to the questionsDB if not already present.
                    if(!( questionsDB.has(currentLinkedQuestions[i][j].question_id))){
                        d3.select("#status").text("System Status: Adding linked question " + currentLinkedQuestions[i][j].question_id + " to cache.")
                        questionsDB.set(currentLinkedQuestions[i][j].question_id, {
                            accepted_answer_id: currentLinkedQuestions[i][j].accepted_answer_id || -1,
                            answer_count: currentLinkedQuestions[i][j].answer_count,
                            creation_date: currentLinkedQuestions[i][j].creation_date,
                            is_answered: currentLinkedQuestions[i][j].is_answered,
                            last_activity_date: currentLinkedQuestions[i][j].last_activity_date,
                            last_edit_date: currentLinkedQuestions[i][j].last_edit_date,
                            link: currentLinkedQuestions[i][j].link,
                            owner: currentLinkedQuestions[i][j].owner,
                            question_id: currentLinkedQuestions[i][j].question_id,
                            score: currentLinkedQuestions[i][j].score,
                            tags: currentLinkedQuestions[i][j].tags,
                            title: currentLinkedQuestions[i][j].title.replace(/&quot;/g, "'").replace(/&#39;/g,"'").replace(/&lt;/g,"<"),
                            linked_questions: secondLevelLinkedIDs
                            //Will also add the list of linked question ID once they come in
                        })                        
                    }
                }
                //Add the list of linked question IDs to the question entry in Question DB
                //This is basically an edge list.
                if(linkedIDs.length > 0){
                    //Extract the question object from the "database"
                    currentEntry = questionsDB.get(questions[i].question_id)
                    //Add the linked_questions element
                    currentEntry["linked_questions"] =  linkedIDs
                    //Now add the question object back into the "database"
                    questionsDB.set(questions[i].question_id, currentEntry)
                }
            }//each matching question
            buildEdgeList(false)
        }); //Promise.all
    }//else - had to query SO  

  }
//=============================================================================
async function SearchForQuestionsLinkedTo(question_id, append_mode) {
  d3.select("#status").text("System Status: Entered SearchForQuestionsLinkedTo("+ question_id+"), " + questionsDB.get(question_id).title)
  
      if(question_id == previousQuery){
          d3.select("#status").text("System Status: Identical query as the previous one. Nothing to do.")
          return
      }
      previousQuery = question_id
  
      //Free memory if DB has grown past the limit
      if(questionsDB.size > dbMaxSize) {
          resetDataStructs()
      }
      //Reset these variables if not in append mode
      else if(!append_mode){
        d3.select("#status").text("System Status: Basic reset.")
        promises = []
        currentLinkedQuestions = []
        currentEdgeList = []
        currentEdgeListofDicts = []
        questions = []
        allIDs.clear()
        uniqueEdges = new Set()
        levelOneIds = new Set()
        minEdgeWeight = 1000;
        maxEdgeWeight = -1000;
        edge_data = []

      }
      //Reset this variable regardless
      promises = []

      let questionIDsPendingLinkedResults = []
      //allIDs = new Set([question_id])
      //questions.push(questionsDB.get(question_id))
      queryRequired = true
      //By definition, the selected question already exists in the database.
      //However, we assume this question doesn't have a linked_questions attribute already in the database        
      //Check our assumption.  If it does exist, does it have at least topMLinkedQuestionLimit entries?
      if(questionsDB.get(question_id).hasOwnProperty("linked_questions")){
            
          d3.select("#status").text("System Status: Already have a database entry for this question with an array of linked question IDs; will attempt to rebuild questions list from cache.");        
          //Get the linked questions from the database, if they exist.
          for(var i = 0; i < questionsDB.get(question_id)["linked_questions"].length; i++){
            if(questionsDB.has(questionsDB.get(question_id)["linked_questions"][i])){
              questions.push(questionsDB.get(questionsDB.get(question_id)["linked_questions"][i]))
              d3.select("#status").text("System Status: Found cached question linked to selected question.")
            }
          }
          //Only issue the query to StackOverflow if we have fewer than topMLinkedQuestionLimit 
          //linked questions, as a new query will get the topMLinkedQuestionLimit questions in single query
          d3.select("#status").text("System Status: Found " + questions.length + " linked questions in the cache:" + questions)
          if(questions.length >= topMLinkedQuestionLimit) queryRequired = false
      }
      //We don't have enough cached linked questions, so just start over
      if(queryRequired){
          d3.select("#status").text("System Status: Calling Stack Overflow API for more questions linked to question: " + question_id)
          //Get the top 5 questions returned by searching with this id
          previousQueries.add(question_id)
          countAPICalls++;
          questions = synchronousGetTopLinkedQuestions(question_id, topNMatchingQuestionLimit)
          questions = questions.slice(0, Math.min(topMLinkedQuestionLimit, questions.length))
          d3.select("#status").text("System Status: Secured final list of  "+questions.length+" questions linked to question: "+ question_id)
      }

      //At this point, questions contains the top M linked questions, 
      //either extracted from the cached data, or retrieved via the API.
      //Iterate over the linked questions, adding appropriate data to various data structs
      for(var i = 0; i < questions.length; i++){
          //First, add the ID of each question to the allIDs array
          allIDs.add(questions[i].question_id);
          //Next, add each question to the question "database" - which is just an in-memory JS object
          //If it is not already in the "database"
          if(!(questionsDB.has(questions[i].question_id))){
              //Next, get the linked questions for this question
              d3.select("#status").text("System Status: Question " + questions[i].question_id + " not found in cache.  Querying Stack Overflow for linked questions.")
              countAPICalls++;
              //In the line below, the 0 will be replaced by 30 in the called function
              let linkedPromise = getTopLinkedQuestions(questions[i].question_id, 0)
              promises.push(linkedPromise)
              questionIDsPendingLinkedResults.push(questions[i].question_id)
          
              //While waiting for the promises above to resolve (i.e. info about linked questions to come in) 
              //add each question to the question "database" - which is just an in-memory JS object
              questionsDB.set(questions[i].question_id,
              {
                  accepted_answer_id: questions[i].accepted_answer_id || -1,
                  answer_count: questions[i].answer_count,
                  creation_date: questions[i].creation_date,
                  is_answered: questions[i].is_answered,
                  last_activity_date: questions[i].last_activity_date,
                  last_edit_date: questions[i].last_edit_date,
                  link: questions[i].link,
                  owner: questions[i].owner,
                  question_id: questions[i].question_id,
                  score: questions[i].score,
                  tags: questions[i].tags,
                  title: questions[i].title.replace(/&quot;/g, "'").replace(/&#39;/g,"'").replace(/&lt;/g,"<"),
  
                  //Will also add the list of linked question IDs once they come in
              })
          }//Only for questions that don't already exist in our in-memory 'database'

          //Question does exist in DB.  But does it have linked_questions?
          //Does it have at least M of them?
          else if(
            !(questionsDB.get(questions[i].question_id).hasOwnProperty("linked_questions"))
            || (questionsDB.get(questions[i].question_id).hasOwnProperty("linked_questions") 
                && (questionsDB.get(questions[i].question_id)["linked_questions"].length < topMLinkedQuestionLimit)
                )
          ){
                d3.select("#status").text("System Status: Question: " +questions[i].question_id +"(" +questions[i].title +") already exists in the database but not enough linked questions.  Execute API query for linked Qs.")
                countAPICalls++;
                //In the line below, the 0 will be replaced by 30 in the called function
                let linkedPromise = getTopLinkedQuestions(questions[i].question_id, 0)
                promises.push(linkedPromise)
                questionIDsPendingLinkedResults.push(questions[i].question_id)

          }
      }//for each of the top matching questions
      levelOneIds = new Set([question_id])
      //Now add the list of linked questions to the selected question's entry in questionsDB.
      //Be careful to avoid duplicates (I should have made it a set to begin with.)
      if(questionsDB.get(question_id).hasOwnProperty("linked_questions")){
        questionsDB.get(question_id)["linked_questions"] = Array.from(new Set(questionsDB.get(question_id)["linked_questions"].concat(allIDs)))
      }
      else{
        d3.select("#status").text("System Status: Adding linked questions attribute to questionDB.")
        questionsDB.get(question_id)["linked_questions"] = Array.from(allIDs)
      }
      
      //Mostly done processing all the initial questions.  At this point the info 
      //about the linked questions is ready.
      //First, we handle the case that all the info was already cached.  
      //In this case, we simply need to rebuild allIDs.  
      //It already has all the level 1 linked question IDs, now add the level 2 ids
      //(Ids of questions linked to the questions linked to the question in question)
      if(promises.length == 0){
          d3.select("#status").text("System Status: Retrieving data from cache.")
          //For each linked question (level 1)
          for(var i = 0; i < questions.length; i++){
              if(!questions[i].hasOwnProperty("linked_questions")) {
                d3.select("#status").text("System Status: question" + questions[i].question_id + " has no linked questions.  Skipping.")
                continue;
              }

              //For each (top M) question (level 2) linked to a (level 1) linked question
              for(var j = 0; j < Math.min(questions[i]["linked_questions"].length, topMLinkedQuestionLimit); j++){
                  //Add its id to allIDs IF the question exists in the database
                  if(questions[i].linked_questions[j] != question_id && questionsDB.has(questions[i].linked_questions[j])){
                    d3.select("#status").text("System Status: Question " + questions[i].question_id + " linked to question " +questions[i].linked_questions[j])
                    allIDs.add(questions[i].linked_questions[j])
                  }
                  else  d3.select("#status").text("System Status: Linked question not in questionsDB. Skipping.")

              }
          }
          //Yay!  Basically done!  Just make a deep copy of allIDs and build the edge list
          //Add the selected question to the front of the set of all IDS
          allIDs = new Set([question_id].concat(Array.from(allIDs)))
          allQueryResults[question_id] = new Set(allIDs)
          buildEdgeList(append_mode)
      }
  
      else{
          //Else, we had to query the API for the level 2 linked questions (and populate the questionsDB)
          Promise.all(promises).then(function(result){
              //Because promises returns ALL promises, only take the M most recent ones resolved
              currentLinkedQuestions = result//.slice(result.length-topMLinkedQuestionLimit, result.length)
              

              d3.select("#status").text("System Status: All promises resolved.")
  
              //For each of the arrays of (level 2) questions returned from the search query...
              for(var i = 0; i < currentLinkedQuestions.length; i++){
                  linkedIDs = []
                  //Push the id of ALL of the linked questions into a temp array of IDs
                  //Do this for completeness.  We want knowledge of as many links as possible,
                  //even if we only display a subset of the links.
                  //This will be stored in the question object in the questionsDB
                  for(var j = 0; j < currentLinkedQuestions[i].length; j++) linkedIDs.push(currentLinkedQuestions[i][j].question_id);
                  d3.select("#status").text("System Status: Found  " + linkedIDs.length + " questions linked to question#" + questionIDsPendingLinkedResults[i] +": " + questionsDB.get(questionIDsPendingLinkedResults[i]).title)
                  //But we'll only display the top M linked questions
                  currentLinkedQuestions[i] = currentLinkedQuestions[i].slice(0, Math.min(topMLinkedQuestionLimit, currentLinkedQuestions[i].length))
                  //For each of the Top M (level 2) linked question...
                  for(var j = 0; j < currentLinkedQuestions[i].length; j++){
                      //Push the ID to allIDs - these will be shown on the graph
                      allIDs.add(currentLinkedQuestions[i][j].question_id)
                      //...add it to the questionsDB if not already present.
                      if(!( questionsDB.has(currentLinkedQuestions[i][j].question_id))){
                          d3.select("#status").text("System Status: Adding question " + currentLinkedQuestions[i][j].question_id + "linked to "+questions[i].question_id+" to cache.")
                          questionsDB.set(currentLinkedQuestions[i][j].question_id, {
                              accepted_answer_id: currentLinkedQuestions[i][j].accepted_answer_id || -1,
                              answer_count: currentLinkedQuestions[i][j].answer_count,
                              creation_date: currentLinkedQuestions[i][j].creation_date,
                              is_answered: currentLinkedQuestions[i][j].is_answered,
                              last_activity_date: currentLinkedQuestions[i][j].last_activity_date,
                              last_edit_date: currentLinkedQuestions[i][j].last_edit_date,
                              link: currentLinkedQuestions[i][j].link,
                              owner: currentLinkedQuestions[i][j].owner,
                              question_id: currentLinkedQuestions[i][j].question_id,
                              score: currentLinkedQuestions[i][j].score,
                              tags: currentLinkedQuestions[i][j].tags,
                              title: currentLinkedQuestions[i][j].title.replace(/&quot;/g, "'").replace(/&#39;/g,"'").replace(/&lt;/g,"<"),
                              linked_questions: linkedIDs
                              //Will also add the list of linked question ID once they come in
                          })                        
                      }
                  }
                  //Perhaps the question already existed in the DB.  We still want to update linked_questions.
                  //Add the list of linked question IDs to the question entry in Question DB
                  //Do NOT overwrite it, append to it.  But this means we need to convert all lists to a set, merge, 
                  //Then convert back to a list.
                  //This is basically an edge list.
                  if(linkedIDs.length > 0){

                      //Extract the question object from the "database"
                      currentEntry = questionsDB.get(questions[i].question_id)
                      //Add the linked_questions element
                      currentEntry["linked_questions"] =  Array.from(new Set(linkedIDs.concat(currentEntry["linked_questions"])))
                      //Now add the question object back into the "database"
                      questionsDB.set(questions[i].question_id, currentEntry)
                  }
              }//each array of level 2 linked questions
              allIDs = new Set([question_id].concat(Array.from(allIDs)))
              allQueryResults[question_id] = new Set(allIDs)
              buildEdgeList(append_mode)
          }); //Promise.all
      }//else - had to query SO  
  }
//=============================================================================
//Functions for API calls below this point

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(ms, backOff)));

}

function httpGetJSON(theUrl)
{
  var xmlHttp = null;

  xmlHttp = new XMLHttpRequest();
  xmlHttp.open("GET", theUrl, false);
  xmlHttp.send(null);
  return JSON.parse(xmlHttp.responseText);
}

var seAdvancedQuestionSearch = function(searchTermsSet, noOfItems){
  var searchTerms = Array.from(searchTermsSet)
  var res = [];
  var pageSize = noOfItems || 20;
  pageSize = Math.min(pageSize, 100);
  var queryString = apiName + "search/advanced?order=desc&sort=relevance&q="+searchTerms[0];


  if( searchTerms.length > 1){
      for (var i = 1; i < searchTerms.length; i++) {
          queryString += "%20" + searchTerms[i];
      }
  }
  queryString +=  "&key=" + apiKey;

  for (var i=0; (noOfItems === undefined) || (i * pageSize < noOfItems); i++){
    var finalQueryString =   queryString + "&page=" + (i+1) + "&closed=False&site=stackoverflow"
    
    if(queriesRemaining <= 10){
      var warningMessage = "System Status: WARNING WARNING WARNING!! REACHED STACKOVERFLOW API LIMIT!  WAIT UNTIL TOMORROW BEFORE RUNNING AGAIN!"
      console.log(warningMessage)
      d3.select("#status").text(warningMessage)
      return
    }

    var resp = httpGetJSON(finalQueryString);
    if (resp.items === undefined){
      d3.select("#status").text("System Status: Error with SE API:\n(call: "
                  + queryString + "&page=" + (i+1) + ")\n"
                  + JSON.stringify(resp, null, 2)
      );        return undefined;
    }
    res = res.concat(resp.items);
    if (resp.has_more === false)
      break;

  }
  if("backOff" in resp){
    d3.select("#status").text("System Status: Received backoff message.  Must wait at least "+ res.backOff.toString() + " seconds")
    sleep(res.backOff)
  }
  return res.slice(0,noOfItems);

}


function synchronousGetTopLinkedQuestions(questionID, noOfItems){
    var pageSize = noOfItems || 100;
    pageSize = Math.min(pageSize, 100);
    var finalQueryString = apiName + "questions/"+questionID+"/linked?order=desc&sort=votes&key=" + apiKey + "&site=stackoverflow";
    var timeSinceLastCall = Date.now()-timeOfLastAPICall;
    if(timeSinceLastCall < apiWaitTime){
      d3.select("#status").text("System Status: Sleep for " + (apiWaitTime - timeSinceLastCall).toString() + " milliseconds")
      sleep(apiWaitTime - timeSinceLastCall)
    }
    timeOfLastAPICall = Date.now()
    if(queriesRemaining <= 10){
      var warningMessage = "System Status: WARNING WARNING WARNING!! REACHED STACKOVERFLOW API LIMIT!  WAIT UNTIL TOMORROW BEFORE RUNNING AGAIN!"
      console.log(warningMessage)
      d3.select("#status").text(warningMessage)
      return
    }
    var resp = httpGetJSON(finalQueryString);
    if (resp.items === undefined){
      var errorMessage = "System Status: Error with SE API:\n(call: "
      + finalQueryString + "&page=" + (i+1) + ")\n"
      + JSON.stringify(resp, null, 2)
      console.log(errorMessage)
      d3.select("#status").text(errorMessage);
      return undefined;
    }

    if("backOff" in resp){
      d3.select("#status").text("System Status: Received backoff message.  Must wait at least " + resp.backOff + " seconds")
      sleep(resp.backOff)
    }
    queriesRemaining = resp.quota_remaining
    d3.select("#queries_remaining").text("Quota Remaining: "+ queriesRemaining)
    return resp.items;
}

async function getTopLinkedQuestions(questionID, noOfItems){
  return new Promise(function(resolve,reject){
    var pageSize = noOfItems || 30;
    pageSize = Math.min(pageSize, 100);
    var finalQueryString = apiName + "questions/"+questionID+"/linked?order=desc&sort=votes&key=" + apiKey + "&site=stackoverflow";

    var timeSinceLastCall = Date.now()-timeOfLastAPICall;
    if(timeSinceLastCall < apiWaitTime){
      d3.select("#status").text("System Status: Sleep for " + (apiWaitTime - timeSinceLastCall).toString() + " milliseconds")
      sleep(apiWaitTime - timeSinceLastCall)
    }
    timeOfLastAPICall = Date.now()
    if(queriesRemaining <= 10){
      var warningMessage = "System Status: WARNING WARNING WARNING!! REACHED STACKOVERFLOW API LIMIT!  WAIT UNTIL TOMORROW BEFORE RUNNING AGAIN!"
      console.log(warningMessage)
      d3.select("#status").text(warningMessage)
      return
    }
    d3.select("#status").text("System Status: Sending query to find questions linked to question :" + questionID.toString());
    var resp = httpGetJSON(finalQueryString);
    if (resp.items === undefined){
      var errorMessage = "System Status: Error with SE API:\n(call: "
      + finalQueryString + "&page=" + (i+1) + ")\n"
      + JSON.stringify(resp, null, 2)
      console.log(errorMessage)
      d3.select("#status").text(errorMessage);
      return undefined;
    }
    else{
      linkedQuestions[questionID] = resp
      queriesRemaining = linkedQuestions[questionID].quota_remaining
      d3.select("#queries-remaining").text("Quota Remaining: "+ queriesRemaining)
    } 

    if("backOff" in resp){
      d3.select("#status").text("System Status: Received backoff message.  Must wait at least " + res.backOff.toString() + " seconds")
      sleep(resp.backOff)
    }
    try{
      resolve(resp.items);
    }
    catch(error){
      d3.select("#status").text("System Status: Caught error" , error)
      resolve([])
    }
  });
}

init()
