function add_note (node_type){
    if (node_type == 'activity'){
        const node_obj = document.getElementById("activity_current");
        const node_class = "activity"
    }else if(node_type == 'food'){
        const node_obj = document.getElementById("food_current");
        const node_class = "food"
    }
    let node_obj_create = "<div class = {node_class}><input type = 'text'/><div>"
    node_type.innerHTML += node_obj_create
}

function send_data(){
    const food_div = document.getElementsByClassName("food");
    const activity_div = document.getElementsByClassName("activity");
    let list_food = [];
    let  list_activity = [];

    array.forEach(food_div => e  {
            list_food.append(e.innerText)  
    });
    array.forEach(activity_div => e  {
            list_activity.append(e.innerText)  
    });
    const upload_data = {user: "x"}
    try{
        const response = await fetch("/")
    }