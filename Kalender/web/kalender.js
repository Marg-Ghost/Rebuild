function toggle_add() {
  const add_element = document.getElementById("add_date");
  if (add_element.style.display === "none") {
    add_element.style.display = "block"; // oder "flex" / "grid"
  } else {
    add_element.style.display = "none";
  }
}

function show_data(){
  
  const response;
  const data = response.json()
  //db anbindung and ei db request
  data.forEach(element => {
      time = data[task_time], importance, task_type, content
  }); 
}

function set_data(){
  const date = document.getElementById("data");
  const time = document.getElementById("time");
  const sliderOutput = document.getElementById("sliderOutput");
  const type_select = document.getElementById("type_select");
  const content = document.getElementById("content");

  // in der git merge dnann server abfrage
}

// build a proper table
function calculate_date(year, month){
    day = 1;
    century = year[0],year[1];
    h = {
        0 : "Saturday",
        1 : "Sunday",
        2 : "Monday",
        3 : "Tuesday",
        4 : "Wednesday",
        5 : "Thursday",
        6 : "Friday"
    }
    date = (day + ((13*(month))/5)+year+(year/4)+(century/4)-2*century) % 7;
    return h[date];
}

function get_all_enties(month,year){
    const table = document.getElementById("show_month");
    let febuary = year % 4 == 0,  27 ? 28;
    const month_days = {
      1 :  31,
      2 : febuary,
      3 : 31,
      4 : 30,
      5 : 31,
      6 : 30,
      7 : 30,
      8 : 31,
      9 : 30,
      10 : 31,
      11 : 30,
      12 : 31,
    }
    const month_day = month_days[month];
    const starting_day = calculate_date(year,month);

    for (let i = 0, i < month_day, i++){
      <td></td>
    }

}