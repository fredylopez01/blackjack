import { useState } from "react";
import { Club, Diamond, Heart, Spade } from "lucide-react";
import { ResetPassword } from "../components/ResetPassword";
import { Login } from "../components/Login";

export default function LoginPage() {
  const [currentView, setCurrentView] = useState("login");

  const changeView = (view: string) => {
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case "login":
        return <Login changeView={changeView} />;
        break;
      case "forgot-password":
        return <ResetPassword changeView={changeView} />;
        break;
      default:
        return <Login changeView={changeView} />;
        break;
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="flex items-center justify-center gap-2 text-center text-6xl font-bold text-white mb-4">
            <Spade /> <Heart /> <Club /> <Diamond />
          </h1>
          <h2 className="text-3xl font-bold text-white">Blackjack</h2>
        </div>

        {renderView()}

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Distributed System Project</p>
          <p className="mt-1">High Availability & Fault Tolerance</p>
        </div>
      </div>
    </div>
  );
}
