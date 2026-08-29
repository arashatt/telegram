import ChatWidget from "./components/ChatWidget.jsx";
import {useSearchParams} from 'react-router-dom';

export default function App() {
  const [searchParams] = useSearchParams();

  return (
    <div className="demo-page">
      <div className="eyebrow">Limoo Host</div>
      <h1>Custom Telegram bots, built for you</h1>
      <p>
        Tell the assistant in the corner what you need — it'll ask the right
        questions and pass your request straight to our team.
      </p>
    <script async src="https://oauth.telegram.org/js/telegram-login.js?6" data-client-id="8928298590" data-onauth="console.log(data)" data-request-access="write"></script>

<button class="tg-auth-button">Sign In with Telegram</button>
      <ChatWidget endpoint="/api/chat/stream" companyName="Limoo Host" />
    </div>
  );
}
