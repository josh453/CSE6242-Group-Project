var autocompleteDisabled = false; //Hit ESCAPE to disable the autcomplete feature for the next word

// "search_br" is the text the user types in the search bar and "list" contains all possible values
// Once the autocomplete engine is done, the possible values are the recommended words
function autocomplete(search_br, list) {
    //execute a function when someone writes in the search bar
    var currentFocus;
    search_br.addEventListener("input", function(e) {
        if (!this.value) { return false; }
        //If autoComplete was disabled, we re-enable it when the user types "space"
        //So check if the last character is space
        if(this.value[search_br.value.length-1] == " "){
            autocompleteDisabled = false
            d3.select("#status").text("System Status: New word, toggling autocomplete on.")            
        } 
        else if(autocompleteDisabled) return;
        // get words from search bar and pick only last word typed
        var val = this.value.split(' ').pop();
        closeAllLists();
        currentFocus = -1;
        //create a DIV element that will contain the items (values):
        var autocmp_menu = document.createElement("DIV");
        autocmp_menu.setAttribute("id", this.id + "autocomplete-list");
        autocmp_menu.setAttribute("class", "autocomplete-items");
        //append the DIV element as a child of the autocomplete container:
        this.parentNode.appendChild(autocmp_menu);
        var startAfterLen = 0;
        var wordsAdded = 0;
        for (var i = 0; val.length > startAfterLen && i < list.length && wordsAdded < 5; i++) {
            // check for words that start with typed substring
            if (list[i].toUpperCase().startsWith(val.toUpperCase())) {
                //Increment the wordsAdded field so we only offer N suggestions
                wordsAdded++;
                //create a DIV element for each matching element:
                var menu_elem = document.createElement("DIV");
                menu_elem.innerHTML = "<text>" + list[i] + "</text>";
                //insert a input field that will hold the current array item's value:
                menu_elem.innerHTML += "<input type='hidden' value='" + list[i] + "'>";
                //execute a function when someone clicks on the item value (DIV element):
                menu_elem.addEventListener("click", function(e) {
                    //insert the value for the autocomplete text field:
                    //We want to APPEND it, but also need to overwrite the existing prefix
                    var selectedWord = this.getElementsByTagName("input")[0].value;
                    var currentWords = search_br.value.split(" ");
                    var currentPrefix = currentWords[currentWords.length-1]
                    var currentSuffix = selectedWord.slice(currentPrefix.length, selectedWord.length)
                    search_br.value += currentSuffix
                    closeAllLists();
                });
                autocmp_menu.appendChild(menu_elem);
            }
        }
    });
    //Define an EventListener for the search bar
    //Not that this ONLY executes when the search bar is in focus
    search_br.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x != null) x = x.getElementsByTagName("div");
        if (e.keyCode === KEY_CODE.ARROW_DOWN && x != null) {
            currentFocus++;
            addActive(x);
        } else if (e.keyCode === KEY_CODE.ARROW_UP && x != null) {
            currentFocus--;
            addActive(x);
        } else if (e.keyCode === KEY_CODE.TAB || e.keyCode === KEY_CODE.ENTER) {
            e.preventDefault();
            if(x != null && typeof x !== 'undefined'){
                if (currentFocus > -1) {
                    // simulate a click on the "active" item:
                    x[currentFocus].click();
                } 
            }
            closeAllLists()
            SearchForQuestions(search_br.value);
        } 
        else if(e.keyCode == 27){
            autocompleteDisabled = !autocompleteDisabled
            if(autocompleteDisabled) d3.select("#status").text("System Status: You pressed ESCAPE; toggling autocomplete off.")
            else d3.select("#status").text("System Status: You pressed ESCAPE; toggling autocomplete on.")
            closeAllLists()
        }
    });



    // a function to classify an item as "active":
    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
    }
    // a function to remove the "active" class from all autocomplete items:
    function removeActive(x) {
        for (var i = 0; i < x.length; i++) {
        x[i].classList.remove("autocomplete-active");
        }
    }
    function closeAllExcept(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (x[i] != elmnt && search_br != elmnt) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }

    function closeAllLists() {
        closeAllExcept(null)
    }

    // execute a function when someone clicks on an item of the autocomplete list
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

function loadAllTags() {
    let p = d3.csv("../data/alltags.csv").then(function (data) {
        data.forEach(function(row){
            words.push(row.TagName);
        })
    }).then(function(){
        // eliminate duplicates by parsing into set and back to array
        words = Array.from(new Set(words));
    })
    return p;
}


