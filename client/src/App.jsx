import { AppBar, Toolbar, Typography, Container, Box, Button, IconButton } from "@mui/material";
import { Link, Routes, Route, Outlet } from "react-router-dom";
import Home from "./Home.jsx";
import About from "./About.jsx";
import NotFound from "./NotFound.jsx";
import styles from "./App.module.css";
import { AuthContext } from "./AuthProvider.jsx";
import { useContext } from "react";
import ColorModeContext from "./ColorModeContext.jsx";
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

function App() {
  function Layout() {
  const { isLogged, logout, login } = useContext(AuthContext);
  const { mode, toggleColorMode } = useContext(ColorModeContext);

    return (
      <>
        <AppBar>
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">Revature</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton color="inherit" onClick={toggleColorMode} aria-label="toggle theme">
                {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>

              {isLogged ? (
                <>
                  <Button color="inherit" component={Link} to="/">Home</Button>
                  <Button color="inherit" component={Link} to="/about">About</Button>
                  <Button color="inherit" component={Link} to="/does-not-exist">404 Test</Button>
                  <Button color="inherit" onClick={logout}>Logout</Button>
                </>
              ) : (
                <Button color="inherit" onClick={login}>Login with ServiceNow</Button>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Container sx={{ mt: 10 }}>
          <Outlet />
        </Container>
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
