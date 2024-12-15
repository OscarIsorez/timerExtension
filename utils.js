export function formatUrl(url) {
    // Supprimer les espaces
    url = url.trim();

    // Ajouter https:// si aucun protocole n'est spécifié
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    // Ajouter .com si aucune extension de domaine n'est présente
    const extensionsCourantes = ['.com', '.org', '.net', '.edu', '.gov', '.fr'];
    const hasExtension = extensionsCourantes.some(ext => url.includes(ext));

    if (!hasExtension) {
        url += '.com';
    }

    return url;
}