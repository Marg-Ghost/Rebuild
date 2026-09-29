function toggle_add() {
  const add_element = document.getElementById("add_date");
  if (add_element.style.display === "none") {
    add_element.style.display = "block"; // oder "flex" / "grid"
  } else {
    add_element.style.display = "none";
  }
}