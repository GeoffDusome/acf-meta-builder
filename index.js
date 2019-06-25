const findInFiles = require('find-in-files');
const fs = require('fs');

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '_')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function recursiveAddKeysToSubFields(subFieldsArray) {
    for ( var i = 0; i < subFieldsArray.length; i++ ) {
        subFieldsArray[i].key = 'field_' + subFieldsArray[i].type + '_' + subFieldsArray[i].name;

        if ( typeof subFieldsArray[i].sub_fields !== 'undefined' ) {
            subFieldsArray[i].sub_fields = recursiveAddKeysToSubFields(subFieldsArray[i].sub_fields);
        }
    }

    return subFieldsArray;
}

module.exports.createMeta = function ( excludes ) {
    var acfMetaArray = {};

    return new Promise( function( resolve, reject ) {
        findInFiles.find( { 'term': 'acfmb', 'flags': 'ig' }, '.', '.php$' )
            .then( function( files ) {
                var newGroupFlag = '';
                var newFileFlag = '';
                var groupCounter = 0;

                for ( var file in files ) {
                    var fileSlug = slugify(file);

                    if ( ! excludes.includes(file) ) {
                        var contents = fs.readFileSync(file, 'utf8');
                        var rows = contents.match(/acfmb\(.*\);/gi);

                        for ( var i = 0; i < rows.length; i++ ) {
                            var explodeString = rows[i].replace(/acfmb\('/gi, '').replace(/'\);/gi, '');
                            var stringArray = explodeString.split('\', \'', 4);

                            // create variables
                            var fieldType = stringArray[0];
                            var fieldName = stringArray[1];
                            var fieldSlug = slugify(fieldName);
                            var fieldGroup = stringArray[2];
                            var fieldGroupSlug = slugify(fieldGroup);
                            var fieldExtras = '';
                            if ( typeof stringArray[3] !== 'undefined' ) {
                                try {
                                    fieldExtras = JSON.parse(stringArray[3]);
                                }
                                catch(err) {
                                    reject('There was an issue parsing your field extras JSON: ' + err);
                                }
                            }

                            var fieldGroupUnique = fieldGroupSlug + '_' + fileSlug;

                            // Check if we are on a new page or new group.
                            if ( newFileFlag !== fileSlug || newGroupFlag !== fieldGroupUnique ) {
                                // Check for new file to reset group counter
                                if ( newFileFlag !== fileSlug ) {
                                    groupCounter = 0;
                                }

                                // Group counter increase
                                groupCounter++;

                                acfMetaArray[fieldGroupUnique] = {
                                    'key': 'group_' + fieldGroupSlug,
                                    'title': fieldGroup,
                                    'menu_order': groupCounter,
                                    'fields': [
                                        {
                                            'key': 'field_' + fieldType + '_' + fieldSlug,
                                            'label': fieldName,
                                            'name': fieldSlug,
                                            'type': fieldType,
                                            'parent': 'group_' + fieldGroupSlug
                                        }
                                    ],
                                };

                                // Merge the field extras with the main field options
                                if ( fieldExtras !== '' ) {
                                    for ( var key of Object.keys(fieldExtras) ) {
                                        // check for sub fields and generate key for each sub field
                                        if ( key === 'sub_fields' ) {
                                            recursiveAddKeysToSubFields(fieldExtras.sub_fields);
                                        }

                                        acfMetaArray[fieldGroupUnique]['fields'][0][key] = fieldExtras[key];
                                    }
                                }

                                // Setup location field
                                // Check if it's a page!
                                if ( file.indexOf('page') !== -1 ) {
                                    if ( file == 'page.php' ) {
                                        acfMetaArray[fieldGroupUnique]['location'] = [
                                            [
                                                {
                                                    'param': 'page_template',
                                                    'operator': '==',
                                                    'value': 'default'
                                                }
                                            ]
                                        ];
                                    }
                                    else {
                                        acfMetaArray[fieldGroupUnique]['location'] = [
                                            [
                                                {
                                                    'param': 'page_template',
                                                    'operator': '==',
                                                    'value': file
                                                }
                                            ]
                                        ];
                                    }
                                }
                                // Check if it's a post type template!
                                else if ( file.indexOf('post-template') !== -1 ) {
                                    acfMetaArray[fieldGroupUnique]['location'] = [
                                        [
                                            {
                                                'param': 'post_template',
                                                'operator': '==',
                                                'value': file
                                            }
                                        ]
                                    ];
                                }
                                // check if we are on a views.php file (post type view)
                                else if ( file.indexOf('views.php') !== -1 ) {
                                    // need to get the folder and then the post type file to get the name
                                    // "file" variable gives us the path to the file relative to the theme root
                                    // fileArr[1] = folder = post type
                                    var fileArr = file.split('/');
                                    
                                    // set post type location
                                    acfMetaArray[fieldGroupUnique]['location'] = [
                                        [
                                            {
                                                'param': 'post_type',
                                                'operator': '==',
                                                'value': fileArr[1]
                                            }
                                        ]
                                    ];
                                }
                                // All other checks in our instance should be post types
                                else {
                                    // get the post type
                                    var postType = '';
                                    if ( file.indexOf('single') !== -1 || file.indexOf('archive') !== -1 ) {
                                        if ( file.indexOf('single.php') !== -1 ) {
                                            postType = 'post';
                                        }
                                        else if ( file.indexOf('archive.php') !== -1 ) {
                                            postType = 'post';
                                        }
                                        else {
                                            postType = file.replace(/(archive-|single-|.php)/gi, '');
                                        }
                                    }

                                    // set post type location
                                    acfMetaArray[fieldGroupUnique]['location'] = [
                                        [
                                            {
                                                'param': 'post_type',
                                                'operator': '==',
                                                'value': postType
                                            }
                                        ]
                                    ];
                                }
                            }
                            else {
                                // Add field to existing array.
                                acfMetaArray[fieldGroupUnique]['fields'].push({
                                    'key': 'field_' + fieldType + '_' + fieldSlug,
                                    'label': fieldName,
                                    'name': fieldSlug,
                                    'type': fieldType,
                                    'parent': 'group_' + fieldGroupSlug
                                });
                                
                                // Merge the field extras with the main field options
                                if ( fieldExtras !== '' )
                                {
                                    for ( var key of Object.keys(fieldExtras) ) {
                                        // check for sub fields and generate key for each sub field
                                        if ( key === 'sub_fields' ) {
                                            recursiveAddKeysToSubFields(fieldExtras.sub_fields);
                                        }
                                        
                                        acfMetaArray[fieldGroupUnique]['fields'][acfMetaArray[fieldGroupUnique]['fields'].length - 1][key] = fieldExtras[key];
                                    }
                                }
                            }

                            // Set flag to check for a new group
                            newGroupFlag = fieldGroupUnique;

                            // Set flag to check for a new page
                            newFileFlag = fileSlug;
                        }
                    }
                }

                // create the directory if it doesn't exist    
                if ( ! fs.existsSync('./acf-json') ) {
                    fs.mkdirSync('./acf-json');
                }

                // write to file
                fs.writeFile('acf-json/acf-meta.json', JSON.stringify(acfMetaArray), {'encoding': 'utf8', 'flag': 'w'}, function(err) {
                    if ( err ) {
                        reject('An error occured while writing JSON Object to File: ' + err);
                    }

                    resolve('Wrote meta to file (acf-json/acf-meta.json).');
                });
            });
    });
}