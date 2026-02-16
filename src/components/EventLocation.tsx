interface EventLocationProps {
  location: string | null;
  mapsLink: string | null;
}

export default function EventLocation({ location, mapsLink }: EventLocationProps) {
  if (!location) {
    return null;
  }

  const href = mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  return (
    <div className="flex items-start gap-2 text-gray-700">
      {/* Map Pin Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 flex-shrink-0 mt-0.5 text-shindig-600"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-shindig-600 hover:underline break-words"
      >
        {location}
      </a>
    </div>
  );
}
