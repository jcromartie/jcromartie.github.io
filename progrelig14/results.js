/*
 * Analysis of the results of the Programmers and Religion Survey data.
 */

// A mapping of short convenient keys to the full survey question as
// found in the CSV header field.

var fields = {
    beliefs: "How would you categorize your beliefs?",
    churchatt: "How often do you voluntarily attend religious services?",
    superexst: "Supernatural forces exist which cannot be directly addressed by science",
    superpers: "I have personally had a supernatural spiritual experience",
    godrelate: "We can relate to God personally, as opposed to an impersonal force",
    godspeaks: "God communicates to people in ways we can clearly understand",
    bibletrue: "Holy scriptures are a reliable source of divine truth",
    bibleusfl: "Holy scriptures are a reliable source of practical guidance for everyday life",
    divpunish: "Unrighteousness or wrongdoing will be punished in the afterlife",
    divreward: "Righteousness is rewarded in the afterlife",
    universal: "All people will eventually be reconciled with or joined to God",
    humangood: "Human beings are basically or inherently good",
    suffersin: "Human suffering in this life is caused by sin or unrighteousness",
    humancrea: "Human beings were specially created in their present form, apart from natural processes",
    naturcrea: "Naturalistic theories are insufficient to account for the origin and complexity of life",
    favlang: "What is your favorite programming language?",
    worklangs: "What is your primary programming language used at work (if any)?",
    progyears: "How many years have you been programming?",
    workyears: "How many years have you been programming professionally?",
    maxeducat: "How would you describe your education?",
    feedback: "Feedback"
};

// these fields allowed multiple responses and will be parsed accordingly
var multiValuedFields = [fields.beliefs, fields.worklangs];

// Fields from the statement section of the survey. Responses ranged
// from 1 (strongly disagree) to 5 (strongly agree), with 0 indicating
// no response.

var statements = [fields.superexst,
                  fields.superpers,
                  fields.godrelate,
                  fields.godspeaks,
                  fields.bibletrue,
                  fields.bibleusfl,
                  fields.divpunish,
                  fields.divreward,
                  fields.universal,
                  fields.humangood,
                  fields.suffersin,
                  fields.humancrea,
                  fields.naturcrea];

var otherNums = [fields.progyears, fields.workyears];

var numericFields = statements.concat(otherNums);

// religions that were represented in the respondants' beliefs
var religions = d3.set(["Christian", "Buddhist", "Jewish", "Muslim", "Pagan", "Hindu"]);

// labels that indicate a particular leaning
var qualitativeModifiers = d3.set(["Liberal", "Moderate", "Conservative"]);

// some predicates for categorizing responses

var predicates = {
    // returns true if the response indicates a religious individual
    isReligious: function (d) {
        return d[fields.beliefs].some(function (x) {
            return religions.has(x);
        });
    },

    makeHasOpinion: function (belief) {
        return function (d) {
            return 0 < d[belief];
        }
    }
};

// some utils for massaging the data

function update(obj, field, f) {
    obj[field] = f(obj[field]);
}

// splits a multi-valued string field into its constituent parts
function parseList(str) {
    return str.split(/[;,]/);
}

var langPatterns = {
    "c++": /c\++/,
    "objective-c": /objective.*c/,
    "go": /go(|lang)/,
    "python": /pyth.*/,
    "c#": /(c#|\.net)/
};

// parse and normalize a programming language response
function parseLang(x) {
    x = x.trim().toLowerCase();
    for (var lang in langPatterns) {
        if (x.match(langPatterns[lang])) {
            return lang;
        }
    }
    return x;
}

// "2014/04/25 11:44:09 AM AST"
var timeFormat = d3.time.format("%Y/%m/%d %I:%M:%S %p AST");

function parseRow(d) {
    multiValuedFields.forEach(function (field) {
        update(d, field, parseList);
    });

    numericFields.forEach(function (field) {
        update(d, field, function (x) { return +x; });
    });

    update(d, "Timestamp", function (x) {
        return timeFormat.parse(x);
    });

    update(d, fields.favlang, parseLang);

    return d;
}

// returns a map of values to the number of times they appear in the array
function counts(values) {
    return values.reduce(function (m, x) {
        m[x] = (m[x] || 0) + 1;
        return m;
    }, {});
}

function runningTotal(elements, accessor) {
    for (var ii = 0; ii < elements.length; ii++) {
        var x = elements[ii];
        x.runningTotal = accessor(x) + (ii == 0 ? 0 : elements[ii - 1].runningTotal);
    }
}

function renderResponseStream(rows) {
    var width = 960,
        height = 400;

    var x = d3.time.scale()
        .domain(d3.extent(rows, function (d) { return d.Timestamp; }))
        .range([0, width]);

    var y = d3.scale.linear()
        .domain([0, 200])
        .range([height, 0]);

    var nesting = d3.nest()
        .key(predicates.isReligious)
        .key(function (d) { return d3.time.hour.ceil(d.Timestamp); });

    // create a stack layout that understands our data grouping above
    var stack = d3.layout.stack()
        .values(function (d) { return d.values; })
        .y(function (d) { return d.values.length; });

    var groupings = nesting.entries(rows);

    var layers = stack(groupings);

    console.log(layers);

    var area = d3.svg.area()
        .x(function (d) { return x(new Date(Date.parse(d.key))); })
        .y0(function (d) { return y(d.y0); })
        .y1(function (d) { return y(d.y0 + d.y); });


    var color = d3.scale.linear()
        .range(["#aad", "#556"]);

    var svg = d3.select("#viz-area").append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.selectAll("path")
        .data(layers)
        .enter()
        .append("path")
        .attr("d", function (d) { return area(d.values); })
        .style("fill", function (d) { return color(Math.random()); });
}

function renderAgreementTable(rows) {
    // try to correlate a specific belief with languages
    var belief = fields.humangood;
    var favlang = fields.favlang;

    var stats = rows
        .filter(predicates.makeHasOpinion(belief))
        .reduce(function (m, row) {
            var beliefValue = row[belief];
            var lang = row[favlang];

            m[lang] = m[lang] || [0, 0, 0];

            var bin = (beliefValue == 3 ? 1 : (beliefValue < 3 ? 0 : 2));
            m[lang][bin]++;

            return m;
        }, {});

    console.log("stats =", stats);

    var data = d3.map(stats).entries();

    // filter out unpopular langs
    data = data.filter(function (d) {
        return 3 < d3.sum(d.value);
    });

    // normalize it
    data = data.map(function (d) {
        var sum = d3.sum(d.value);
        return { key: d.key, value: d.value.map(function (x) { return x / sum; }) };
    });

    var section = d3.select("#viz-area").append("section");
    var langDiv = section.selectAll("div")
        .data(data)
        .enter()
        .append("div");

    langDiv.selectAll("span")
        .data(function (d) { return d.value; })
        .enter()
          .append("span")
          .attr("class", function (d, i) { return "i" + i; })
          .style("width", (function (d) { return (d * 100) + "px"; }));

    langDiv.append("span").text(function (d) { return d.key; });

    langDiv.sort(function (a, b) {return d3.descending (a.value[2], b.value[2])});
}

// load the CSV data and handle the result
d3.csv("/progrelig14/responses.csv", parseRow, function (error, rows) {
    console.log("error =", error);
    console.log("rows =", rows);

    window.rows = rows;

    if (rows) {
        renderResponseStream(rows);
    }
});
