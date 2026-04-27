import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import InputField from "../Rsvp/InputField";
import Button from "../Button";
import "./Login.scss";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate("/admin");
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      console.log(err.message);
      setError("Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login">
      <h2>Login</h2>
      {error && <p className="login-error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <InputField
          title="Email"
          isRequired
          type="email"
          val={email}
          setVal={setEmail}
        />
        <InputField
          title="Password"
          isRequired
          type="password"
          val={password}
          setVal={setPassword}
        />
        <Button
          disabled={!(email && password) || isSubmitting}
          onClick={handleSubmit}
          title={isSubmitting ? "Signing in..." : "Login"}
        />
      </form>
    </div>
  );
};

export default Login;
