import { createBrowserRouter } from "react-router-dom";
import App from "./App";

import Home from "./pages/Home";
import FindProject from "./pages/FindProject";
import UnderstandProject from "./pages/UnderstandProject";
import UserCenter from "./pages/UserCenter";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "find-project",
        element: <FindProject />,
      },
      {
        path: "understand-project",
        element: <UnderstandProject />,
      },
      {
        path: "user-center",
        element: <UserCenter />,
      },
    ],
  },
]);

export default router;