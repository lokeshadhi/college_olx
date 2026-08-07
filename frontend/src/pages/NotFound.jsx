import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";

const NotFound = () => (
  <MainLayout>
    <div className="notfound-shell">
      <div className="notfound-stamp">404</div>
      <h1>This listing has been taken down</h1>
      <p style={{ maxWidth: 420, marginBottom: 24 }}>
        The page you're looking for doesn't exist, or the product may have already been removed.
      </p>
      <Link to="/">
        <Button variant="primary">Back to Home</Button>
      </Link>
    </div>
  </MainLayout>
);

export default NotFound;
