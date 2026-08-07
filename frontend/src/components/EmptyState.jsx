import { FiInbox } from "react-icons/fi";

// Shown whenever a list has nothing to display (no products, no search
// results, no listings yet) — always paired with a next action.
const EmptyState = ({ icon: Icon = FiInbox, title = "Nothing here yet", message, action }) => (
  <div className="empty-state">
    <div className="empty-icon">
      <Icon />
    </div>
    <h3>{title}</h3>
    {message && <p>{message}</p>}
    {action}
  </div>
);

export default EmptyState;
