import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "./components/layout";

// Pages
import Dashboard from "./pages/dashboard";
import AnnouncementCenter from "./pages/announcement-center";
import CollaborationHub from "./pages/collaboration-hub";
import ResourceManager from "./pages/resource-manager";
import AssignmentTracker from "./pages/assignment-tracker";
import Tasks from "./pages/tasks";
import Assistant from "./pages/assistant";
import Feedback from "./pages/feedback";
import About from "./pages/about";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/announcements" component={AnnouncementCenter} />
        <Route path="/collab" component={CollaborationHub} />
        <Route path="/resources" component={ResourceManager} />
        <Route path="/assignments" component={AssignmentTracker} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/assistant" component={Assistant} />
        <Route path="/feedback" component={Feedback} />
        <Route path="/about" component={About} />
        <Route path="/sources">
          <Redirect to="/announcements" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
