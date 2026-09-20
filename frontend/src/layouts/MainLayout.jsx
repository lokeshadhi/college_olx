import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";

const MainLayout = ({ children, hideFooter = false }) => (
  <>
    <Navbar />
    <main>{children}</main>
    {!hideFooter && <Footer />}
  </>
);

export default MainLayout;
