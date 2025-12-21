import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function AuthConfirm() {
  const navigate = useNavigate();

  useEffect(() => {
    const confirm = async () => {
      await supabase.auth.exchangeCodeForSession(window.location.href);
      navigate("/login");
    };
    confirm();
  }, []);

  return <p>Confirming your email...</p>;
}
