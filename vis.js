d3.selection.prototype.moveToFront = function() { 
  return this.each(function() { 
    this.parentNode.appendChild(this); 
  }); 
};

var baseAvatarUrl = "http://photos1.meetupstatic.com/photos/member"

var avatarWidth = 40;
var avatarHeight = 40;

var rectWidth = 20;
var rectHeight = 20;
var rectSpace = 10;

var width = d3.select("#display").node().clientWidth
var height = d3.select("#display").node().clientHeight
var timelineHeight = 100;

var target = {x: 1000, y: height/2};




//////////////////////////////////////////////////////////////////////////////
// Data preparation
//////////////////////////////////////////////////////////////////////////////

var q = queue()
.defer(d3.json, "members.json")
.defer(d3.json, "meetups.json")
.defer(d3.json, "rsvps.json")
.await(function(err, members, meetups, rsvps) {
  if(err) return console.log(err);
  
//we create a lookup table for the members and meetup events
var membersDict = {};
members.sort(function(a,b) {
  return a.joined - b.joined
})
members.forEach(function(member) {
  membersDict[member.id] = member;
});
var firstMember = members[0];
var lastMember = members[members.length - 1];


var meetupsDict = {};
meetups.sort(function(a,b) {
  return a.time - b.time
})
meetups.forEach(function(meetup) {
  meetupsDict[meetup.id] = meetup;
});

var activeMeetup = meetups[0].id;

var memberXf = crossfilter(members);
var memberDims = {
  "joined": memberXf.dimension(function(d) { return d.joined })
}

var dayGroup = memberDims.joined.group(function(d) { return d3.time.day.floor(new Date(d)) });
var membersByDay = dayGroup.all();

var dayBuckets = {}
members.forEach(function(member) {
  var day = d3.time.day.floor(new Date(member.joined))
  if(!dayBuckets[day]) {
    dayBuckets[day] = [member]
  } else {
    dayBuckets[day].push(member)
  }
})

var xf = crossfilter(rsvps);
var dims = {
  "member": xf.dimension(function(d) { return d.id }),
  "events": xf.dimension(function(d) { return d.evt }),
  "rsvp": xf.dimension(function(d) { return d.response })
};

dims.rsvp.filter('yes');

//////////////////////////////////////////////////////////////////////////////
// Rendering
//////////////////////////////////////////////////////////////////////////////
var display = d3.select("#display")

//////////////////////////////////////////////////////////////////////////////
// Scrolling
//////////////////////////////////////////////////////////////////////////////


//calculate our intended height
var visHeight = membersByDay.length * (rectHeight + rectSpace);

var aLittleLessThanADay = 22*60*60*1000;
var timeScale = d3.time.scale()
  .domain([firstMember.joined-aLittleLessThanADay, lastMember.joined ])
  .range([0, visHeight])
  
var mbdExtent = d3.extent(membersByDay, function(d) { return d.value })
var mbdScale = d3.scale.linear()
.domain(mbdExtent)
.range([rectWidth,200])

var format = d3.time.format("%b %d, %Y")

//draw fixie
var fixie = d3.select("#fixie")
var timeDomain = timeScale.domain()
var range = d3.time.day.range(timeDomain[0], timeDomain[1],1)
fixie.selectAll(".day")
.data(range)
.enter()
  .append("div")
  .classed("day", true)
  .style({
    top: function(d,i) { return timeScale(d) + "px" },
    left: 0,
    width: "100%",
    height: rectHeight + "px"
  })
.on("mouseover", function(d,i) {
  stats.select('.date').text(format(d));
  var filtered = memberDims.joined.filter([0, +d+aLittleLessThanADay]).top(Infinity)
  stats.select('.total').text(filtered.length + " members so far");
})
.append("span")
.text(function(d) { 
  for(var i = membersByDay.length; i--;) {
    var a = +membersByDay[i].key;
    var b = +d
    if(a === b) {
      var value = (membersByDay[i].value || 0);
      return  value + " member" + (value === 1 ? '' : 's') + " joined on " + format(d);
    }
  }
  return "0 members joined on " + format(d);
})



////////////////////////////////////
//draw events
////////////////////////////////////
var meetupdiv = display.append("div").classed("meetups", true)

var descs = meetupdiv.selectAll("div.meetup")
.data(meetups)
.enter()
.append("div")
.classed("meetup", true)
.style({
  top: function(d,i) { return timeScale(d3.time.day.floor(new Date(d.time))) + "px" },
  left: "0px",
  width: "900px",
  height: "20px"
})
.on("mouseover", function() {
  d3.select(this).moveToFront();
})
.on("click", function(d,i) {
  activeMeetup = d.id;
  rsvpForce(d);
  d3.selectAll("div.meetup").select(".meetup-desc").classed("active-meetup", false);
  d3.select(this).select(".meetup-desc").classed("active-meetup", true);
})

.append("div")
.classed("meetup-desc", true)

descs.append("span").text(function(d) { return d.name }).classed("name", true)
descs.append("br")
descs.append("span").text(function(d) { return format(new Date(d.time)) })
descs.append("br")
descs.append("span").text(function(d) { return "@ " +d.venue })
descs.append("br")
descs.append("span")
.classed("rsvplink", true)
.text(function(d) { 
  var rsvpers = dims.events.filter(d.id);
  var nRsvpers = rsvpers.top(Infinity).length;

  return nRsvpers
})




////////////////////////////////////
//draw faces
////////////////////////////////////
var bardiv = display.append("div")
.classed("facebar", true)
.style({
  height: 20 + visHeight + "px"
})


bardiv.selectAll(".face")
.data(members, function(d) { return d.id })
.enter()
.append("div")
.classed("face", true)
.style({
  top: function(d,i) { 
    var y = timeScale(d3.time.day.floor(new Date(d.joined)))  
    d.y0 = y;
    return y + "px"
  },
  left: function(d,i) {
    var day = d3.time.day.floor(new Date(d.joined));
    var x = dayBuckets[day].indexOf(d) * rectWidth
    d.x0 = x || 0;
    return x + "px"
  },
  width: rectWidth + "px",
  height: rectHeight + "px"
})
//.style("display", "none")
.append("a")
.attr({
  href: function(d) { return "http://www.meetup.com/Bay-Area-d3-User-Group/members/" + d.id },
  target: "_blank"
})
.append("img")
.attr({
  src: function(d) { return baseAvatarUrl + d.avatar },
  width: rectWidth,
  height: rectHeight,
  title: function(d) { return d.name }
})





var stats = display.select('#stats');
//stats.classed('fixed', true);
var formatDate = format;
//var formatDate = d3.time.format("%d/%b/%y");
//var currentEvent = 'd3 + MV* frameworks';

display.on("scroll", scroller);
//scroller()
function scroller() {
  height = d3.select("#display").node().clientHeight
    
  var scroll = this.scrollTop || 0;
  var y0 = timeScale.invert(scroll - 100);
  var y1 = timeScale.invert(scroll + height);//calculate a screen's worth of height
  var filtered = memberDims.joined.filter([y0, y1]).top(Infinity)
    
  //target = {y: scroll + height/2}
  
  var faces = bardiv.selectAll(".face")
  .data(filtered, function(d) { return d.id })

  
  faces
  .style("display", "")
  faces.exit()
  .style("display", "none")
  
  //stats.select('.event').text(currentEvent);
  stats.select('.date').text(formatDate(timeScale.invert(scroll+height)));
  stats.select('.total').text(memberDims.joined.filter([0, y1]).top(Infinity).length + " members so far");
  
}




//////////////////////////////////////////////////////////////////////////////
// Force Layout
//////////////////////////////////////////////////////////////////////////////
var xyGravity = [0, 0.1];
var nodes = []
var radius = d3.scale.sqrt().range([4, 9]);
var padding = 6;

var force = d3.layout.force()
  .size([target.x, visHeight])
  .nodes(nodes)
  .gravity(0.0001)
  .charge(getMember(function(d){ return d.radius * 3}))
  .friction(0.803442944)
  .on("tick", tick)
  .start();
  
function getMember(f) {
  return function(d,i) {
    var c = membersDict[d.key];
    return f(c,i);
  }
}

function tick(e) {
  var k = 0.01;
  function anchor(d,i) {
    var my = timeScale(meetupsDict[activeMeetup].time)
    if(!my) return;
    nodes.forEach(function(o, i) {
      o.x += (target.x - o.x) * e.alpha * k;
      o.y += (my - o.y) * e.alpha * k;
    });
  }
  
  sel = display.selectAll("div.node")
   .each(getMember(gravity(xyGravity)))
   .each(getMember(anchor))
   .each(getMember(collide(0.5)))
   .style({
     left: getMember(function(d) { return d.x + "px" }),
     top: getMember(function(d) { return d.y + "px" })
   }) 
}


function rsvpForce(meetup) {
   //update force layout;
  force.stop()
    
  //var members = memberDims.joined.filter([0, meetup.time])
  //var nMembers = members.top(Infinity).length;
  var rsvpers = dims.events.filter(meetup.id);
  var nRsvpers = rsvpers.top(Infinity).length;
  
  var newnodes = dims.member.group().all()
  .filter(function(d) { return d.value > 0 });

  var gnodes = display.selectAll("div.node")//fsvg.selectAll("g.node")
  .data(newnodes, function(d) { return d.key });
  
  var exit = gnodes.exit()
  .each(function(c) {
    var d = membersDict[c.key];
    var idx = nodes.indexOf(d)
    if(idx >= 0) {
      nodes.splice(idx, 1);
    }
  })
  exit.transition()
  .duration(1000)
  .style("opacity", 0.001)
  .remove();
    
  var baseRadius = 10;
  var startRadius = 200;
  var enter = gnodes.enter()
  .append("div")
    .classed("node", true)
    .each(function(c,i) {
      var key = c.key;
      d = membersDict[key];
      d.key = key;
      d.id = d.key;
      d.x = d.x0 + 0//width/2 + Math.cos(Math.random() * 2 * Math.PI) * startRadius;
      d.y = d.y0 + 0// + height/2 - target.y
      //d.x = width/2 + Math.cos(Math.random() * 2 * Math.PI) * startRadius;
      //d.y = height/2 + Math.sin(Math.random() * 2 * Math.PI) * startRadius;
      d.px = d.x + 0;
      d.py = d.y + 0;
      d.radius = radius(baseRadius);
      nodes.push(d);
    })
  
  enter
    .append("a")
    .attr({
      href: getMember(function(d) { return "http://www.meetup.com/Bay-Area-d3-User-Group/members/" + d.id }),
      target: "_blank"
    })
    .append("img")
  .attr({
    src: getMember(function(d) { return baseAvatarUrl + d.avatar }),
    width: avatarWidth,
    height: avatarHeight,
    title: getMember(function(d) { return d.name })
  })
  .style({
    opacity: 0
  })
  //.transition()
  //.duration(800)
  .style("opacity", 0.9)
  
  force.resume();
}


function gravity(g) {
  return function(d) {
    d.x += g[0]
    d.y += g[1]
  }
}
// Resolves collisions between d and all other circles.
function collide(alpha) {
  var quadtree = d3.geom.quadtree(nodes);
  return function(d) {
    var r = d.radius + radius.domain()[1] + padding,
        nx1 = d.x - r,
        nx2 = d.x + r,
        ny1 = d.y - r,
        ny2 = d.y + r;
    quadtree.visit(function(quad, x1, y1, x2, y2) {
      if (quad.point && (quad.point !== d)) {
        var x = d.x - quad.point.x,
            y = d.y - quad.point.y,
            l = Math.sqrt(x * x + y * y),
            r = d.radius + quad.point.radius + (d.color !== quad.point.color) * padding;
        if (l < r) {
          l = (l - r) / l * alpha;
          d.x -= x *= l;
          d.y -= y *= l;
          quad.point.x += x;
          quad.point.y += y;
        }
      }
      return x1 > nx2
          || x2 < nx1
          || y1 > ny2
          || y2 < ny1;
    });
  };
}

});
