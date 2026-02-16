import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto py-20">
        <h1 className="text-6xl font-bold tracking-tight mb-4">
          🎉 Shindig
        </h1>
        <p className="text-2xl text-gray-600 mb-2">
          Event invites that don&apos;t suck.
        </p>
        <p className="text-lg text-gray-500 mb-10">
          Create a beautiful event page. Invite people by email or text.
          Collect RSVPs with dietary restrictions, plus-ones, and gift preferences.
          Send reminders automatically. All free.
        </p>

        <div className="flex gap-4 justify-center mb-16">
          <Link
            href="/create"
            className="bg-shindig-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-shindig-700 transition-colors"
          >
            Create an Event
          </Link>
          <Link
            href="/e/demo"
            className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-full text-lg font-semibold hover:border-gray-400 transition-colors"
          >
            See a Demo
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2">Create</h3>
            <p className="text-gray-600">
              Set up your event in 60 seconds. Add a cover image, location, and all the details.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📨</div>
            <h3 className="text-xl font-semibold mb-2">Invite</h3>
            <p className="text-gray-600">
              Add guests by email or phone. We send beautiful invitations with a unique RSVP link.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Track</h3>
            <p className="text-gray-600">
              See who&apos;s coming in real time. Dietary needs, plus-ones, everything in one dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Request CTA */}
      <div className="bg-shindig-50 w-full py-16">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">This app gets better because of you</h2>
          <p className="text-lg text-gray-600 mb-8">
            Shindig is built by AI and shaped by users. Suggest a feature, vote on ideas,
            and watch them go live — sometimes within hours.
          </p>
          <Link
            href="/features"
            className="text-shindig-600 font-semibold text-lg hover:text-shindig-700"
          >
            💡 See the feature board →
          </Link>
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-4xl mx-auto py-20 px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="border rounded-2xl p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Free</h3>
            <p className="text-4xl font-bold mb-4">$0</p>
            <ul className="text-gray-600 space-y-2 mb-8">
              <li>3 events / month</li>
              <li>30 guests / event</li>
              <li>Email invitations</li>
              <li>RSVP tracking</li>
            </ul>
            <Link
              href="/create"
              className="block border-2 border-shindig-600 text-shindig-600 px-6 py-2 rounded-full font-semibold hover:bg-shindig-50 transition-colors"
            >
              Get Started
            </Link>
          </div>
          <div className="border-2 border-shindig-600 rounded-2xl p-8 text-center relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-shindig-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Popular
            </div>
            <h3 className="text-xl font-semibold mb-2">Pro</h3>
            <p className="text-4xl font-bold mb-4">$5<span className="text-lg text-gray-500">/mo</span></p>
            <ul className="text-gray-600 space-y-2 mb-8">
              <li>Unlimited events</li>
              <li>200 guests / event</li>
              <li>SMS invitations & reminders</li>
              <li>Custom branding</li>
              <li>No &quot;Powered by&quot; footer</li>
            </ul>
            <Link
              href="/create"
              className="block bg-shindig-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-shindig-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
          <div className="border rounded-2xl p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Event Pass</h3>
            <p className="text-4xl font-bold mb-4">$2<span className="text-lg text-gray-500"> once</span></p>
            <ul className="text-gray-600 space-y-2 mb-8">
              <li>One premium event</li>
              <li>200 guests</li>
              <li>SMS + email</li>
              <li>Perfect for one-off parties</li>
            </ul>
            <Link
              href="/create"
              className="block border-2 border-shindig-600 text-shindig-600 px-6 py-2 rounded-full font-semibold hover:bg-shindig-50 transition-colors"
            >
              Buy a Pass
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t py-8 text-center text-gray-500 text-sm">
        <p>Shindig — Built with 🤖 and ❤️ — <Link href="/features" className="text-shindig-600 hover:underline">Suggest a feature</Link></p>
      </footer>
    </div>
  );
}
