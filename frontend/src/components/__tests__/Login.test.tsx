import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import { Login } from "../../components/Login";
import { authAPI } from "../../services/api";
import toast from "react-hot-toast";

// Mock navigate
const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

// Mock zustand store
const mockLogin = jest.fn();
jest.mock("../../store/authStore", () => ({
  useAuthStore: jest.fn((selector) => {
    const store = {
      login: mockLogin,
    };
    return selector(store);
  }),
}));

// Mock toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock API module
jest.mock("../../services/api");
const mockedAuthAPI = authAPI as jest.Mocked<typeof authAPI>;

describe("Login Component", () => {
  const changeViewMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = () =>
    render(
      <BrowserRouter>
        <Login changeView={changeViewMock} />
      </BrowserRouter>
    );

  test("renders Login form correctly", () => {
    setup();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit-button")).toBeInTheDocument();
  });

  test("shows password validation error on invalid password", async () => {
    const user = userEvent.setup();
    setup();

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const loginBtn = screen.getByTestId("login-submit-button");

    await user.type(emailInput, "test@test.com");
    await user.type(passwordInput, "abc");

    await user.click(loginBtn);

    // Esperar a que aparezca el mensaje de error
    await waitFor(() => {
      expect(
        screen.getByText(/La contraseña debe tener al menos 8 caracteres/i)
      ).toBeInTheDocument();
    });

    expect(mockedAuthAPI.login).not.toHaveBeenCalled();
  });

  test("calls login API and navigates when valid credentials provided", async () => {
    const user = userEvent.setup();
    mockedAuthAPI.login.mockResolvedValueOnce({ token: "fake-token" });
    mockedAuthAPI.getProfile.mockResolvedValueOnce({
      data: {
        user: {
          id: "123",
          email: "test@test.com",
          role: "user",
          balance: 1000,
        },
      },
    });

    setup();

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const loginBtn = screen.getByTestId("login-submit-button");

    await user.type(emailInput, "test@test.com");
    await user.type(passwordInput, "Abcde@123");

    await user.click(loginBtn);

    await waitFor(() => {
      expect(mockedAuthAPI.login).toHaveBeenCalledWith(
        "test@test.com",
        "Abcde@123"
      );
    });

    expect(mockedAuthAPI.getProfile).toHaveBeenCalled();
    expect(mockLogin).toHaveBeenCalledWith("fake-token", {
      id: "123",
      email: "test@test.com",
      role: "user",
      balance: 1000,
    });
    expect(toast.success).toHaveBeenCalledWith("Welcome back!");
    expect(mockedUsedNavigate).toHaveBeenCalledWith("/lobby");
  });

  test("displays error when login fails", async () => {
    const user = userEvent.setup();
    mockedAuthAPI.login.mockRejectedValueOnce({
      response: { data: { error: "Invalid credentials" } },
    });

    setup();

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    const loginBtn = screen.getByTestId("login-submit-button");

    await user.type(emailInput, "test@test.com");
    await user.type(passwordInput, "Abcde@123");

    await user.click(loginBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });

    expect(mockedUsedNavigate).not.toHaveBeenCalled();
  });
});
