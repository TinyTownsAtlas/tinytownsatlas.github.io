// Demo mode only. Adds a small, muted "My TEN4TEN (demo)" text link directly under the site subtitle
// in the header. It carries no identity, token or query string: the demo has its own simulated
// sign-in on its own page. The Atlas stays the primary project; this is a secondary entry.
import "./entry-link.css";

const brand = document.getElementById("brand");
if (brand && !document.getElementById("my-ten4ten-link")) {
  const link = document.createElement("a");
  link.id = "my-ten4ten-link";
  link.href = `${import.meta.env.BASE_URL}my-ten4ten/`;
  link.rel = "nofollow";
  link.textContent = "My TEN4TEN (demo)";
  brand.append(link);
}
