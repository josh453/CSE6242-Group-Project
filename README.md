# GA Tech - CSE6242 Group Project
### Completed in Fall 2019
### DESCRIPTION

[Our project](https://groupprojectcse6242.s3.amazonaws.com/html/index.html) is a browser-based StackOverflow visualization tool utilizing HTML, CSS, Javascript, and a D3 force-directed graph to show how different questions on StackOverflow are linked together.
Each node represents a question on StackOverflow, collected by using the StackOverflow API. 

### INSTALLATION

Simply unzip the folder and start a simple http server in that directory. For example, on Windows 10, if the unzipped folder is in `C:\User\Documents`, open `cmd.exe`, change directory to `C:\User\Documents`, and type `python -m http.server`.  Then open any browser and go to `localhost:8000`.

### EXECUTION

To use our project, simply type a query into the search bar and hit Enter once you've entered at least three words and 10 characters. (Use the mouse, arrow keys, Tab, and Enter to use the autocomplete feature.) Please be patient as some graphs take several seconds to build due to the StackOverflow API rate limit.  Once the graph is built, hover over a node to display the question's title. The number on the node indicates the computed score (PageRank) indicating how relavant it is to the search term (lower numbers indicate higher relavance.)  Thick links indicate strong similarity between question titles.  If you find the graph is moving too much, simply click the button to freeze it in place.

Single click a node to pin it to the canvas and display its title, click again to free it and hide the title.
Ctrl+single click will open the question at StackOverflow.com
Double-clicking a node will generate a new query and build a new graph centered (if possible) around that question.

We found the following queries give interesting results:
* "python list comprehension"
* "python upgrade pip"
* "undo git commit"
* "stack and heap"
