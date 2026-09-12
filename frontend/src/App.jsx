import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import BrowseProducts from "./pages/BrowseProducts.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import SellProduct from "./pages/SellProduct.jsx";
import EditProduct from "./pages/EditProduct.jsx";
import MyProducts from "./pages/MyProducts.jsx";
import Profile from "./pages/Profile.jsx";
import Chat from "./pages/Chat.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";

function App() {
  return (
    <SocketProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "Inter, sans-serif",
            fontSize: "0.9rem",
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/browse" element={<BrowseProducts />} />
        <Route path="/products/:id" element={<ProductDetails />} />

        <Route
          path="/sell"
          element={
            <ProtectedRoute>
              <SellProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id/edit"
          element={
            <ProtectedRoute>
              <EditProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-products"
          element={
            <ProtectedRoute>
              <MyProducts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </SocketProvider>
  );
}

export default App;
