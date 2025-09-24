// [TCA2] core/i18n.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [core/i18n.js] Loaded");


        function loadTranslations()
        {
            console.log("Checking for user-specific language preference");

            // Call the Cachetur API to check if the user is logged in and get their language preference
            ctApiCall("user_get_current", "", function (response)
            {
                let selectedLanguage = "en"; // Default language fallback

                // If the user is logged in and has a language set, use that
                if (response && response.username && response.language)
                {
                    selectedLanguage = response.language;
                    console.log("User is logged in. Using preferred language:", selectedLanguage);
                }
                else
                {
                    // Otherwise, use browser language (only if it's in the whitelist)
                    const browserLanguage = navigator.language || navigator.userLanguage;
                    selectedLanguage = browserLanguage;
                    console.log("User not logged in. Using browser language:", selectedLanguage);
                }

                // Initialize i18next with the selected language
                i18next
                    .use(i18nextXHRBackend)
                    .use(i18nextBrowserLanguageDetector)
                    .init(
                    {
                        whitelist: ['nb_NO', 'en', 'de_DE', 'sv_SE', 'en_US', 'da_DK', 'nl_NL', 'fr_FR', 'cs_CZ', 'fi_FI', 'es_ES'],
                        preload: ['nb_NO', 'en', 'de_DE', 'sv_SE', 'en_US', 'da_DK', 'nl_NL', 'fr_FR', 'cs_CZ', 'fi_FI', 'es_ES'],
                        fallbackLng: ['nb_NO', 'en', 'de_DE', 'sv_SE', 'en_US', 'da_DK', 'nl_NL', 'fr_FR', 'cs_CZ', 'fi_FI', 'es_ES'],
                        lng: selectedLanguage,
                        ns: ['cachetur'],
                        defaultNS: 'cachetur',
                        backend:
                        {
                            loadPath: 'https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json',
                            crossDomain: true
                        }
                    }, (err, t) =>
                    {
                        if (err)
                        {
                            if (err.indexOf("failed parsing") > -1)
                            {
                                i18next.changeLanguage('en_US');
                                return loadTranslations(); // Retry with fallback language
                            }
                            return console.log("Error occurred when loading language data:", err);
                        }

                        const resolvedLanguage = i18next.language;
                        console.log("Translation loaded successfully:", resolvedLanguage);

                        ctStart(); // Proceed to start the main application logic
                    });
            });
        }
    console.log("[TCA2] [core/i18n.js] Ready");
  } catch (e) {
    console.error("[TCA2] [core/i18n.js] Error during module execution", e);
  }
})();
