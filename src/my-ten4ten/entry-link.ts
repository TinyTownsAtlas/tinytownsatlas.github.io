// Demo mode only. Adds a small, discreet "My TEN4TEN (demo)" text link at the foot of the map
// layer card. It carries no identity, token or query string: the demo has its own simulated
// sign-in on its own page. The Atlas stays the primary project; this is a secondary entry.
import "./entry-link.css";

const control = document.getElementById("layer-control");
if (control && !document.getElementById("my-ten4ten-link")) {
  const row = document.createElement("p");
  row.className = "demo-link-row";
  const link = document.createElement("a");
  link.id = "my-ten4ten-link";
  link.href = `${import.meta.env.BASE_URL}my-ten4ten/`;
  link.rel = "nofollow";
  link.textContent = "My TEN4TEN (demo)";
  row.append(link);
  control.append(row);
}
